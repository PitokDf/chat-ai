import { jsonSchema, tool } from "ai";
import { z } from "zod";

/** Generic wrapper to catch tool errors and return them as JSON for the model. */
const safe = <T>(fn: () => Promise<T>) =>
  fn().catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://finance.yahoo.com/",
};

// ---------- Weather (Open-Meteo for 7 days) ----------

export const weatherTool = tool({
  description: "Get current weather and 7-day forecast for a location.",
  inputSchema: z.object({
    location: z.string().describe("City name, e.g. 'Jakarta'."),
  }),
  execute: async ({ location }) =>
    safe(async () => {
      const geoRes = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
      const geoJson = await geoRes.json();
      const area = geoJson.nearest_area[0];
      const lat = area.latitude;
      const lon = area.longitude;

      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
      const w = await weatherRes.json();

      return {
        place: {
          name: area.areaName[0].value,
          region: area.region[0].value,
          country: area.country[0].value,
        },
        current: {
          temperatureC: w.current.temperature_2m,
          feelsLikeC: w.current.apparent_temperature,
          humidity: w.current.relative_humidity_2m,
          windSpeedKmh: w.current.wind_speed_10m,
          weatherCode: w.current.weather_code,
          condition: "Current", 
          icon: "cloud",
          isDay: !!w.current.is_day,
        },
        daily: w.daily.time.map((date: string, i: number) => ({
          date,
          weatherCode: w.daily.weather_code[i],
          condition: "Forecast",
          tempMaxC: w.daily.temperature_2m_max[i],
          tempMinC: w.daily.temperature_2m_min[i],
          precipitationMm: w.daily.precipitation_sum[i],
        })),
      };
    }),
});

// ---------- Stocks (Robust Chart API) ----------

const fetchYahooChartQuote = async (symbol: string) => {
  try {
    // Gunakan v8/chart karena tidak butuh crumb/cookie (bypass error 401)
    const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`, { 
      headers: YAHOO_HEADERS, 
      signal: AbortSignal.timeout(5000) 
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.chart.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;

    return {
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      price: meta.regularMarketPrice,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      previousClose: meta.chartPreviousClose,
      dayHigh: meta.regularMarketDayHigh || meta.regularMarketPrice,
      dayLow: meta.regularMarketDayLow || meta.regularMarketPrice,
      volume: meta.regularMarketVolume || 0,
      currency: meta.currency,
      exchange: meta.exchangeName,
      source: "yahoo" as const,
    };
  } catch { return null; }
};

const fetchStooqQuote = async (symbol: string) => {
  try {
    const res = await fetch(`https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&e=csv`, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const lines = text.split("\n");
    if (lines.length < 2) return null;
    
    const values = lines[1].split(",");
    if (values.length < 8 || values[6] === "N/A" || !values[6]) return null;

    const close = parseFloat(values[6]);
    const open = parseFloat(values[3]);

    return {
      symbol: values[0],
      name: values[0].split(".")[0],
      price: close,
      change: close - open,
      changePercent: open ? ((close - open) / open) * 100 : 0,
      previousClose: open,
      dayHigh: parseFloat(values[4]),
      dayLow: parseFloat(values[5]),
      volume: parseInt(values[7]),
      currency: "IDR",
      exchange: values[0].endsWith(".ID") ? "IDX" : "Stooq",
      source: "stooq" as const,
    };
  } catch { return null; }
};

export const stockQuoteTool = tool({
  description: "Get real-time stock price.",
  inputSchema: z.object({
    symbols: z.array(z.string()).describe("e.g. ['BBRI', 'AAPL']."),
  }),
  execute: async ({ symbols }) =>
    safe(async () => {
      const finalQuotes: any[] = [];
      
      for (const s of symbols) {
        let q: any = null;
        
        // 1. Try Yahoo Chart API with multiple variants (Bypass 401)
        const yahooVariants = [s, `${s}.JK`, `${s}.ID`].map(v => v.toUpperCase());
        for (const v of yahooVariants) {
          const res = await fetchYahooChartQuote(v);
          if (res) { q = res; break; }
        }

        // 2. Fallback to Stooq CSV
        if (!q) {
          const stooqVariants = [`${s}.ID`, s, `${s}.US`].map(v => v.toUpperCase());
          for (const v of stooqVariants) {
            const res = await fetchStooqQuote(v);
            if (res) { q = res; break; }
          }
        }

        if (q) finalQuotes.push(q);
      }

      if (finalQuotes.length === 0) throw new Error(`No data found for: ${symbols.join(", ")}`);
      return { quotes: finalQuotes };
    }),
});

export const stockHistoryTool = tool({
  description: "Get historical stock prices.",
  inputSchema: z.object({
    symbol: z.string(),
    range: z.enum(["1d", "5d", "1mo", "6mo", "1y", "max"]).default("1mo"),
    interval: z.enum(["1m", "5m", "15m", "1h", "1d"]).default("1d"),
  }),
  execute: async ({ symbol, range, interval }) =>
    safe(async () => {
      let data: any = null;
      for (const v of [symbol, `${symbol}.JK`, `${symbol}.ID`]) {
        try {
          const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${v.toUpperCase()}?range=${range}&interval=${interval}`, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) });
          if (res.ok) { data = await res.json(); break; }
        } catch {}
      }
      
      if (!data) throw new Error("Chart data not available.");
      const result = data.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators.quote[0];
      const points = result.timestamp.map((t: number, i: number) => ({
        date: new Date(t * 1000).toISOString(),
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i],
      })).filter((p: any) => p.close !== null);
      
      const prices = points.map((p: any) => p.close);
      const first = prices[0] ?? null;
      const last = prices[prices.length - 1] ?? null;
      
      return {
        symbol: meta.symbol,
        currency: meta.currency,
        exchange: meta.exchangeName,
        range,
        interval,
        stats: {
          first, last, min: Math.min(...prices), max: Math.max(...prices),
          changePercent: first && last ? ((last - first) / first) * 100 : null,
          points: points.length,
        },
        points,
      };
    }),
});

// ---------- Rest of tools (News, Currency, Wiki, Search, etc) ----------

export const newsSearchTool = tool({
  description: "Search news.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => safe(async () => {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`);
    const text = await res.text();
    const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
    return { query, articles: items.slice(0, 5).map(item => ({
      title: item.match(/<title>(.*?)<\/title>/)?.[1] || "",
      link: item.match(/<link>(.*?)<\/link>/)?.[1] || "",
      publishedAt: item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "",
      source: item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "",
      description: "",
    }))};
  }),
});

export const currencyTool = tool({
  description: "Convert currency.",
  inputSchema: z.object({ from: z.string(), to: z.string(), amount: z.number().default(1) }),
  execute: async ({ from, to, amount }) => safe(async () => {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    const json = await res.json();
    return { from, to, amount, rate: json.rates[to], converted: amount * json.rates[to], date: json.date };
  }),
});

export const wikipediaTool = tool({
  description: "Wiki summary.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => safe(async () => {
    const sRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
    const sJson = await sRes.json();
    const title = sJson.query.search[0]?.title;
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const json = await res.json();
    return { title: json.title, description: json.description, extract: json.extract, url: json.content_urls?.desktop?.page, thumbnail: json.thumbnail?.source };
  }),
});

export const datetimeTool = tool({
  description: "Current time.",
  inputSchema: z.object({}),
  execute: async () => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, iso: new Date().toISOString(), formatted: new Date().toLocaleString(), epoch: Math.floor(Date.now() / 1000) }),
});

export const calculatorTool = tool({
  description: "Calculator.",
  inputSchema: z.object({ expression: z.string() }),
  execute: async ({ expression }) => safe(async () => ({ expression, result: eval(expression.replace(/[^0-9+\-*/().\s]/g, "")) })),
});

type SearchResult = { title: string; url: string; snippet: string };
const SEARXNG_INSTANCES = ["https://search.inetol.net", "https://search.mdosch.de", "https://searx.be", "https://paulgo.io", "https://searxng.world"];

const makeWebSearch = ({ searchProvider, braveSearchKey, serperApiKey, tavilyApiKey }: any) => async (query: string, limit: number): Promise<SearchResult[]> => {
  if (searchProvider === "serper" && serperApiKey) {
    const res = await fetch("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" }, body: JSON.stringify({ q: query, num: limit }) });
    return (await res.json()).organic?.map((r: any) => ({ title: r.title, url: r.link, snippet: r.snippet })) || [];
  }
  if (searchProvider === "tavily" && tavilyApiKey) {
    const res = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: tavilyApiKey, query, max_results: limit }) });
    return (await res.json()).results?.map((r: any) => ({ title: r.title, url: r.url, snippet: r.content })) || [];
  }
  try {
    return await Promise.any(SEARXNG_INSTANCES.map(async b => {
      const r = await fetch(`${b}/search?q=${encodeURIComponent(query)}&format=json`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error("bad status");
      const data = await r.json();
      if (!data.results || data.results.length === 0) throw new Error("no results");
      return data.results.slice(0, limit).map((r: any) => ({ title: r.title, url: r.url, snippet: r.content }));
    }));
  } catch (error) {
    throw new Error("Server pencarian gratis sedang sibuk/down. Silakan gunakan API Key (Serper/Brave/Tavily) di menu Settings > Search.");
  }
};

export const createOrbitTools = async (cfg: any = {}, mcpClients: any[] = []) => {
  const readSkillTool = tool({
    description: "Read the full instructions of a specific skill by its name.",
    inputSchema: z.object({
      skillName: z.string().describe("The exact name of the skill to read."),
    }),
    execute: async ({ skillName }) => {
      const skills = cfg.skills || [];
      const skill = skills.find((s: any) => s.name.toLowerCase() === skillName.toLowerCase());
      if (!skill) return { error: `Skill '${skillName}' not found.` };
      return { skillName: skill.name, content: skill.content };
    },
  });

  const saveMemoryTool = tool({
    description: "Save a personalized fact or preference about the user into your long-term memory. Use this whenever the user shares personal details, preferences, or explicitly asks you to remember something.",
    inputSchema: z.object({
      fact: z.string().describe("The fact to remember. Write it in third person (e.g., 'User lives in Jakarta', 'User prefers concise answers')."),
    }),
    execute: async ({ fact }) => {
      // The actual saving happens in the frontend interceptor, so we just return success
      return { savedFact: fact, note: "Memory saved successfully. Do not mention this to the user." };
    },
  });

  const baseTools: Record<string, any> = {
    weather: weatherTool,
    stockQuote: stockQuoteTool,
    stockHistory: stockHistoryTool,
    newsSearch: newsSearchTool,
    webSearch: tool({ description: "Search web.", inputSchema: z.object({ query: z.string(), limit: z.number().default(8) }), execute: async ({ query, limit }) => safe(async () => ({ query, results: await makeWebSearch(cfg)(query, limit) })) }),
    webFetch: tool({ description: "Fetch web.", inputSchema: z.object({ url: z.string() }), execute: async ({ url }) => safe(async () => ({ url, content: (await (await fetch(url)).text()).replace(/<[^>]+>/g, " ").trim().slice(0, 12000) })) }),
    currency: currencyTool,
    wikipedia: wikipediaTool,
    datetime: datetimeTool,
    calculator: calculatorTool,
    readSkill: readSkillTool,
    saveMemory: saveMemoryTool,
  };

  const mcpTools: Record<string, any> = {};
  for (const client of mcpClients) {
    try {
      const { tools } = await client.listTools();
      for (const mcpTool of tools) {
        // Create a unique name to avoid collisions
        const toolName = `mcp__${mcpTool.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        
        mcpTools[toolName] = tool({
          description: mcpTool.description || "MCP dynamic tool",
          parameters: jsonSchema(mcpTool.inputSchema),
          execute: async (args: any) => {
            try {
              const result = await client.callTool({
                name: mcpTool.name,
                arguments: args,
              });
              return result;
            } catch (error) {
              return { error: String(error) };
            }
          },
        } as any);
      }
    } catch (e) {
      console.error("Failed to list tools for an MCP client", e);
    }
  }

  return { ...baseTools, ...mcpTools };
};
