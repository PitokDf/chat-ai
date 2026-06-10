import { jsonSchema, tool } from "ai";
import { z } from "zod";

import { youtubeMusicTool } from "@/lib/agent/youtube";

/** Generic wrapper to catch tool errors and return them as JSON for the model. */
const safe = <T>(fn: () => Promise<T>) =>
  fn().catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
      const geoRes = await fetch(
        `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      );
      const geoJson = await geoRes.json();
      const area = geoJson.nearest_area[0];
      const lat = area.latitude;
      const lon = area.longitude;

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
      );
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
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      {
        headers: YAHOO_HEADERS,
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.chart.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;

    return {
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      price: meta.regularMarketPrice,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent:
        ((meta.regularMarketPrice - meta.chartPreviousClose) /
          meta.chartPreviousClose) *
        100,
      previousClose: meta.chartPreviousClose,
      dayHigh: meta.regularMarketDayHigh || meta.regularMarketPrice,
      dayLow: meta.regularMarketDayLow || meta.regularMarketPrice,
      volume: meta.regularMarketVolume || 0,
      currency: meta.currency,
      exchange: meta.exchangeName,
      source: "yahoo" as const,
    };
  } catch {
    return null;
  }
};

const fetchStooqQuote = async (symbol: string) => {
  try {
    const res = await fetch(
      `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&e=csv`,
      { signal: AbortSignal.timeout(5000) },
    );
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
  } catch {
    return null;
  }
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
        const yahooVariants = [s, `${s}.JK`, `${s}.ID`].map((v) =>
          v.toUpperCase(),
        );
        for (const v of yahooVariants) {
          const res = await fetchYahooChartQuote(v);
          if (res) {
            q = res;
            break;
          }
        }

        // 2. Fallback to Stooq CSV
        if (!q) {
          const stooqVariants = [`${s}.ID`, s, `${s}.US`].map((v) =>
            v.toUpperCase(),
          );
          for (const v of stooqVariants) {
            const res = await fetchStooqQuote(v);
            if (res) {
              q = res;
              break;
            }
          }
        }

        if (q) finalQuotes.push(q);
      }

      if (finalQuotes.length === 0)
        throw new Error(`No data found for: ${symbols.join(", ")}`);
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
          const res = await fetch(
            `https://query2.finance.yahoo.com/v8/finance/chart/${v.toUpperCase()}?range=${range}&interval=${interval}`,
            { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) },
          );
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {}
      }

      if (!data) throw new Error("Chart data not available.");
      const result = data.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators.quote[0];
      const points = result.timestamp
        .map((t: number, i: number) => ({
          date: new Date(t * 1000).toISOString(),
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
          volume: quotes.volume[i],
        }))
        .filter((p: any) => p.close !== null);

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
          first,
          last,
          min: Math.min(...prices),
          max: Math.max(...prices),
          changePercent: first && last ? ((last - first) / first) * 100 : null,
          points: points.length,
        },
        points,
      };
    }),
});

export const stockTechnicalAnalysisTool = tool({
  description:
    "Get comprehensive technical analysis indicators (SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, ATR, VWAP, Support/Resistance) to help analyze stock trends.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock symbol, e.g. 'AAPL' or 'BBCA'."),
    range: z.enum(["3mo", "6mo", "1y", "2y"]).default("1y").describe("Data range for analysis."),
  }),
  execute: async ({ symbol, range }) =>
    safe(async () => {
      let data: any = null;
      for (const v of [symbol, `${symbol}.JK`, `${symbol}.ID`]) {
        try {
          const res = await fetch(
            `https://query2.finance.yahoo.com/v8/finance/chart/${v.toUpperCase()}?range=${range}&interval=1d`,
            { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) },
          );
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {}
      }

      if (!data)
        throw new Error("Chart data not available for technical analysis.");
      const result = data.chart.result[0];

      const allPoints = result.timestamp
        .map((t: number, i: number) => ({
          date: new Date(t * 1000).toISOString(),
          close: result.indicators.quote[0].close[i],
          high: result.indicators.quote[0].high[i],
          low: result.indicators.quote[0].low[i],
          open: result.indicators.quote[0].open[i],
          volume: result.indicators.quote[0].volume[i],
        }))
        .filter((p: any) => p.close !== null);

      const closePrices = allPoints.map((p: any) => p.close);
      const highPrices = allPoints.map((p: any) => p.high);
      const lowPrices = allPoints.map((p: any) => p.low);
      const volumes = allPoints.map((p: any) => p.volume);

      if (closePrices.length < 50) {
        throw new Error("Not enough data to calculate technical indicators.");
      }

      const chartData = allPoints.slice(-60).map((p: any) => ({
        date: new Date(p.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        price: p.close,
      }));

      const calculateSMA = (prices: number[], period: number) => {
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
      };

      const calculateEMA = (prices: number[], period: number) => {
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) {
          ema = (prices[i] - ema) * k + ema;
        }
        return ema;
      };

      const calculateMACD = (prices: number[]) => {
        const shortEMA = calculateEMA(prices, 12);
        const longEMA = calculateEMA(prices, 26);
        const macdLine = shortEMA - longEMA;
        const signalLine = calculateEMA(prices.slice(-9), 9);
        return { macdLine, signalLine, histogram: macdLine - signalLine };
      };

      const calculateBollingerBands = (
        prices: number[],
        period: number = 20,
      ) => {
        const slice = prices.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance =
          slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return {
          upper: sma + stdDev * 2,
          middle: sma,
          lower: sma - stdDev * 2,
        };
      };

      const calculateRSI = (prices: number[], period: number) => {
        let gains = 0;
        let losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
          const diff = prices[i] - prices[i - 1];
          if (diff >= 0) gains += diff;
          else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - 100 / (1 + rs);
      };

      const calculateStochastic = (highs: number[], lows: number[], closes: number[], period: number = 14) => {
        const recentHighs = highs.slice(-period);
        const recentLows = lows.slice(-period);
        const highestHigh = Math.max(...recentHighs);
        const lowestLow = Math.min(...recentLows);
        const currentClose = closes[closes.length - 1];
        const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
        return { k, d: k };
      };

      const calculateATR = (highs: number[], lows: number[], closes: number[], period: number = 14) => {
        const trueRanges: number[] = [];
        for (let i = 1; i < closes.length; i++) {
          const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
          );
          trueRanges.push(tr);
        }
        const atrSlice = trueRanges.slice(-period);
        return atrSlice.reduce((a, b) => a + b, 0) / period;
      };

      const calculateVWAP = (highs: number[], lows: number[], closes: number[], volumes: number[]) => {
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;
        for (let i = 0; i < closes.length; i++) {
          const tp = (highs[i] + lows[i] + closes[i]) / 3;
          cumulativeTPV += tp * volumes[i];
          cumulativeVolume += volumes[i];
        }
        return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : closes[closes.length - 1];
      };

      const calculateSupportResistance = (highs: number[], lows: number[], closes: number[]) => {
        const recentCloses = closes.slice(-60);
        const recentHighs = highs.slice(-60);
        const recentLows = lows.slice(-60);

        const pivot = (recentHighs[recentHighs.length - 1] + recentLows[recentLows.length - 1] + recentCloses[recentCloses.length - 1]) / 3;
        const r1 = 2 * pivot - recentLows[recentLows.length - 1];
        const s1 = 2 * pivot - recentHighs[recentHighs.length - 1];
        const r2 = pivot + (recentHighs[recentHighs.length - 1] - recentLows[recentLows.length - 1]);
        const s2 = pivot - (recentHighs[recentHighs.length - 1] - recentLows[recentLows.length - 1]);

        return { pivot, r1, r2, s1, s2 };
      };

      const currentPrice = closePrices[closePrices.length - 1];
      const sma20 = calculateSMA(closePrices, 20);
      const sma50 = calculateSMA(closePrices, 50);
      const sma200 = closePrices.length >= 200 ? calculateSMA(closePrices, 200) : null;
      const ema12 = calculateEMA(closePrices, 12);
      const ema26 = calculateEMA(closePrices, 26);
      const rsi14 = calculateRSI(closePrices, 14);
      const macd = calculateMACD(closePrices);
      const bb = calculateBollingerBands(closePrices);
      const stochastic = calculateStochastic(highPrices, lowPrices, closePrices);
      const atr = calculateATR(highPrices, lowPrices, closePrices);
      const vwap = calculateVWAP(highPrices, lowPrices, closePrices, volumes);
      const sr = calculateSupportResistance(highPrices, lowPrices, closePrices);

      let trend = "Neutral";
      if (currentPrice > sma20 && sma20 > sma50) trend = "Bullish (Uptrend)";
      else if (currentPrice < sma20 && sma20 < sma50)
        trend = "Bearish (Downtrend)";

      if (sma200 && currentPrice > sma200) trend += " (Long-term Bullish)";
      else if (sma200 && currentPrice < sma200) trend += " (Long-term Bearish)";

      let momentum = "Neutral";
      if (rsi14 > 70) momentum = "Overbought";
      else if (rsi14 < 30) momentum = "Oversold";

      let macdSignal = "Neutral";
      if (macd.macdLine > macd.signalLine) macdSignal = "Bullish Crossover";
      else if (macd.macdLine < macd.signalLine)
        macdSignal = "Bearish Crossover";

      let stochasticSignal = "Neutral";
      if (stochastic.k > 80) stochasticSignal = "Overbought";
      else if (stochastic.k < 20) stochasticSignal = "Oversold";

      let volatility = "Normal";
      if (atr > currentPrice * 0.03) volatility = "High";
      else if (atr < currentPrice * 0.01) volatility = "Low";

      return {
        symbol: result.meta.symbol,
        currentPrice,
        indicators: {
          sma20,
          sma50,
          sma200,
          ema12,
          ema26,
          rsi14,
          macd: {
            macdLine: macd.macdLine,
            signalLine: macd.signalLine,
            histogram: macd.histogram,
          },
          bollingerBands: {
            upper: bb.upper,
            middle: bb.middle,
            lower: bb.lower,
          },
          stochastic: {
            k: stochastic.k,
            d: stochastic.d,
          },
          atr: {
            value: atr,
            percent: (atr / currentPrice) * 100,
          },
          vwap,
          supportResistance: sr,
        },
        analysis: {
          trend,
          momentum,
          macdSignal,
          stochasticSignal,
          volatility,
          bbPosition: currentPrice > bb.upper ? "Above Upper" : currentPrice < bb.lower ? "Below Lower" : "Within Bands",
          vwapPosition: currentPrice > vwap ? "Above VWAP (Bullish)" : "Below VWAP (Bearish)",
          nearSupport: Math.abs(currentPrice - sr.s1) / currentPrice < 0.02,
          nearResistance: Math.abs(currentPrice - sr.r1) / currentPrice < 0.02,
        },
        chartData,
      };
    }),
});

// ---------- Rest of tools (News, Currency, Wiki, Search, etc) ----------

export const newsSearchTool = tool({
  description: "Search news.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) =>
    safe(async () => {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
      );
      const text = await res.text();
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
      return {
        query,
        articles: items.slice(0, 5).map((item) => ({
          title: item.match(/<title>(.*?)<\/title>/)?.[1] || "",
          link: item.match(/<link>(.*?)<\/link>/)?.[1] || "",
          publishedAt: item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "",
          source: item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "",
          description: "",
        })),
      };
    }),
});

export const currencyTool = tool({
  description: "Convert currency.",
  inputSchema: z.object({
    from: z.string(),
    to: z.string(),
    amount: z.number().default(1),
  }),
  execute: async ({ from, to, amount }) =>
    safe(async () => {
      const res = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${from}`,
      );
      const json = await res.json();
      return {
        from,
        to,
        amount,
        rate: json.rates[to],
        converted: amount * json.rates[to],
        date: json.date,
      };
    }),
});

export const wikipediaTool = tool({
  description: "Wiki summary.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) =>
    safe(async () => {
      const sRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
      );
      const sJson = await sRes.json();
      const title = sJson.query.search[0]?.title;
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      );
      const json = await res.json();
      return {
        title: json.title,
        description: json.description,
        extract: json.extract,
        url: json.content_urls?.desktop?.page,
        thumbnail: json.thumbnail?.source,
      };
    }),
});

export const datetimeTool = tool({
  description: "Current time.",
  inputSchema: z.object({}),
  execute: async () => ({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    iso: new Date().toISOString(),
    formatted: new Date().toLocaleString(),
    epoch: Math.floor(Date.now() / 1000),
  }),
});

export const calculatorTool = tool({
  description: "Calculator.",
  inputSchema: z.object({ expression: z.string() }),
  execute: async ({ expression }) =>
    safe(async () => ({
      expression,
      result: eval(expression.replace(/[^0-9+\-*/().\s]/g, "")),
    })),
});

type SearchResult = { title: string; url: string; snippet: string };
const SEARXNG_INSTANCES = [
  "https://search.inetol.net",
  "https://search.mdosch.de",
  "https://searx.be",
  "https://paulgo.io",
  "https://searxng.world",
];

const makeWebSearch =
  ({ searchProvider, braveSearchKey, serperApiKey, tavilyApiKey }: any) =>
  async (query: string, limit: number): Promise<SearchResult[]> => {
    if (searchProvider === "serper" && serperApiKey) {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: limit }),
      });
      return (
        (await res.json()).organic?.map((r: any) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
        })) || []
      );
    }
    if (searchProvider === "tavily" && tavilyApiKey) {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          max_results: limit,
        }),
      });
      return (
        (await res.json()).results?.map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        })) || []
      );
    }
    try {
      return await Promise.any(
        SEARXNG_INSTANCES.map(async (b) => {
          const r = await fetch(
            `${b}/search?q=${encodeURIComponent(query)}&format=json`,
            { signal: AbortSignal.timeout(5000) },
          );
          if (!r.ok) throw new Error("bad status");
          const data = await r.json();
          if (!data.results || data.results.length === 0)
            throw new Error("no results");
          return data.results.slice(0, limit).map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
          }));
        }),
      );
    } catch (error) {
      throw new Error(
        "Server pencarian gratis sedang sibuk/down. Silakan gunakan API Key (Serper/Brave/Tavily) di menu Settings > Search.",
      );
    }
  };

// ---------- NEW TOOLS: Market Movers, Crypto, Risk Calc, Fundamental, Sentiment ----------

export const marketMoversTool = tool({
  description: "Get top gainers or losers in the stock market today.",
  inputSchema: z.object({
    type: z
      .enum(["gainers", "losers"])
      .describe("Type of market movers to fetch."),
  }),
  execute: async ({ type }) =>
    safe(async () => {
      const scrId = type === "gainers" ? "day_gainers" : "day_losers";
      const res = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-US&region=US&scrIds=${scrId}&count=5`,
        { headers: YAHOO_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch market movers");
      const data = await res.json();
      const quotes = data.finance?.result?.[0]?.quotes || [];
      return {
        type,
        movers: quotes.map((q: any) => ({
          symbol: q.symbol,
          name: q.shortName || q.longName,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
        })),
      };
    }),
});

export const cryptoTrackerTool = tool({
  description: "Get current price and data for major cryptocurrencies.",
  inputSchema: z.object({
    coinIds: z
      .array(z.string())
      .describe(
        "List of coin gecko IDs, e.g. ['bitcoin', 'ethereum', 'dogecoin']",
      ),
  }),
  execute: async ({ coinIds }) =>
    safe(async () => {
      const ids = coinIds.join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`,
      );
      if (!res.ok) throw new Error("Failed to fetch crypto data");
      const data = await res.json();
      return {
        cryptos: data.map((c: any) => ({
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          price: c.current_price,
          change24h: c.price_change_percentage_24h,
          marketCap: c.market_cap,
          volume24h: c.total_volume,
          image: c.image,
        })),
      };
    }),
});

export const riskCalculatorTool = tool({
  description:
    "Calculate risk to reward, position size, and loss based on trading capital.",
  inputSchema: z.object({
    capital: z.number().describe("Total trading capital in IDR/USD etc."),
    entryPrice: z.number().describe("Buying price per share"),
    stopLossPrice: z.number().describe("Stop loss price per share"),
    riskPercentage: z
      .number()
      .describe("Max risk percentage of total capital (e.g. 1 or 2)"),
    targetPrice: z.number().optional().describe("Target taking profit price"),
  }),
  execute: async ({
    capital,
    entryPrice,
    stopLossPrice,
    riskPercentage,
    targetPrice,
  }) =>
    safe(async () => {
      const maxLossAmount = capital * (riskPercentage / 100);
      const riskPerShare = entryPrice - stopLossPrice;

      if (riskPerShare <= 0)
        throw new Error(
          "Stop loss must be lower than entry price for long positions.",
        );

      const sharesToBuy = Math.floor(maxLossAmount / riskPerShare);
      const totalInvestment = sharesToBuy * entryPrice;
      const actualLoss = sharesToBuy * riskPerShare;

      let rewardPerShare = null;
      let rrr = null;
      let profitAmount = null;

      if (targetPrice) {
        rewardPerShare = targetPrice - entryPrice;
        if (rewardPerShare > 0) {
          rrr = rewardPerShare / riskPerShare;
          profitAmount = sharesToBuy * rewardPerShare;
        }
      }

      return {
        capital,
        riskPercentage,
        maxLossAmount,
        entryPrice,
        stopLossPrice,
        targetPrice,
        sharesToBuy,
        totalInvestment,
        actualLoss,
        rewardPerShare,
        profitAmount,
        rrr,
      };
    }),
});

export const fundamentalAnalysisTool = tool({
  description:
    "Get comprehensive fundamental analysis data for a stock including P/E, Market Cap, Book Value, EPS, Dividend Yield, and more from Yahoo Finance.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock symbol, e.g. 'BBCA' or 'AAPL'."),
  }),
  execute: async ({ symbol }) =>
    safe(async () => {
      let data: any = null;
      for (const v of [symbol, `${symbol}.JK`, `${symbol}.ID`]) {
        try {
          const res = await fetch(
            `https://query2.finance.yahoo.com/v8/finance/chart/${v.toUpperCase()}?range=1d&interval=1d`,
            { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) },
          );
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {}
      }

      if (!data) throw new Error("Symbol not found");
      const meta = data.chart.result?.[0]?.meta;
      if (!meta) throw new Error("Symbol not found");

      const quote = await fetchYahooChartQuote(symbol);

      let fundamentalData: any = null;
      try {
        const quoteSummaryRes = await fetch(
          `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${meta.symbol}?modules=defaultKeyStatistics,financialData,summaryDetail,earningsHistory`,
          { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) },
        );
        if (quoteSummaryRes.ok) {
          const summaryData = await quoteSummaryRes.json();
          fundamentalData = summaryData.quoteSummary?.result?.[0];
        }
      } catch {}

      const stats = fundamentalData?.defaultKeyStatistics || {};
      const financial = fundamentalData?.financialData || {};
      const summary = fundamentalData?.summaryDetail || {};

      return {
        symbol: meta.symbol,
        name: meta.shortName || meta.longName || meta.symbol,
        price: meta.regularMarketPrice,
        currency: meta.currency,
        exchange: meta.exchangeName,
        valuation: {
          marketCap: summary.marketCap?.fmt || stats.marketCap?.fmt || "N/A",
          trailingPE: summary.trailingPE?.raw || stats.trailingPE?.raw || null,
          forwardPE: summary.forwardPE?.raw || stats.forwardPE?.raw || null,
          priceToBook: summary.priceToBook?.raw || stats.priceToBook?.raw || null,
          enterpriseToRevenue: stats.enterpriseToRevenue?.raw || null,
          enterpriseToEbitda: stats.enterpriseToEbitda?.raw || null,
        },
        profitability: {
          profitMargin: financial.profitMargins?.raw || stats.profitMargins?.raw || null,
          operatingMargin: financial.operatingMargins?.raw || stats.operatingMargins?.raw || null,
          returnOnEquity: financial.returnOnEquity?.raw || stats.returnOnEquity?.raw || null,
          returnOnAssets: financial.returnOnAssets?.raw || stats.returnOnAssets?.raw || null,
          revenueGrowth: financial.revenueGrowth?.raw || stats.revenueGrowth?.raw || null,
          earningsGrowth: financial.earningsGrowth?.raw || stats.earningsGrowth?.raw || null,
        },
        perShare: {
          epsTrailing: stats.trailingEps?.raw || null,
          epsForward: stats.forwardEps?.raw || null,
          bookValue: stats.bookValue?.raw || null,
          revenuePerShare: stats.revenuePerShare?.raw || null,
        },
        dividends: {
          yield: summary.dividendYield?.raw || stats.dividendYield?.raw || null,
          rate: summary.dividendRate?.raw || stats.dividendRate?.raw || null,
          payoutRatio: stats.payoutRatio?.raw || null,
        },
        financialHealth: {
          totalCash: financial.totalCash?.fmt || stats.totalCash?.fmt || "N/A",
          totalDebt: financial.totalDebt?.fmt || stats.totalDebt?.fmt || "N/A",
          debtToEquity: stats.debtToEquity?.raw || null,
          currentRatio: financial.currentRatio?.raw || stats.currentRatio?.raw || null,
          quickRatio: financial.quickRatio?.raw || stats.quickRatio?.raw || null,
        },
        trading: {
          beta: stats.beta?.raw || null,
          fiftyTwoWeekHigh: summary.fiftyTwoWeekHigh?.raw || null,
          fiftyTwoWeekLow: summary.fiftyTwoWeekLow?.raw || null,
          averageVolume: summary.averageVolume?.raw || null,
          shortRatio: stats.shortRatio?.raw || null,
        },
        notice:
          "Data from Yahoo Finance. Some fields may be N/A for certain markets (e.g., IDX stocks may have limited fundamental data).",
      };
    }),
});

export const financialSentimentTool = tool({
  description:
    "Analyze market sentiment for a stock by pulling latest headlines and performing keyword-based sentiment scoring.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock symbol"),
    language: z.enum(["en", "id"]).default("en").describe("Language for news search."),
  }),
  execute: async ({ symbol, language }) =>
    safe(async () => {
      const langParam = language === "id" ? "hl=id&gl=ID&ceid=ID:id" : "hl=en-US&gl=US&ceid=US:en";
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + " stock saham")}&${langParam}`,
      );
      if (!res.ok) throw new Error("News search failed: " + res.status);
      const text = await res.text();
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];

      const bullishKeywords = [
        "surge", "rally", "jump", "gain", "rise", "bullish", "upgrade", "outperform",
        "buy", "strong", "record high", "breakout", "growth", "profit", "beat",
        "naik", "rekor", "untung", "positif", "optimistis", "rekomendasi beli",
      ];
      const bearishKeywords = [
        "crash", "drop", "fall", "decline", "loss", "bearish", "downgrade", "underperform",
        "sell", "weak", "low", "breakdown", "recession", "miss", "warning",
        "turun", "rugi", "negatif", "pesimis", "rekomendasi jual", "anjlok",
      ];

      const articles = items.slice(0, 10).map((item) => {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || "";
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "";

        const titleLower = title.toLowerCase();
        let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
        let score = 0;

        for (const kw of bullishKeywords) {
          if (titleLower.includes(kw)) score++;
        }
        for (const kw of bearishKeywords) {
          if (titleLower.includes(kw)) score--;
        }

        if (score > 0) sentiment = "bullish";
        else if (score < 0) sentiment = "bearish";

        return { title, pubDate, source, sentiment, score };
      });

      const totalScore = articles.reduce((acc, a) => acc + a.score, 0);
      const bullishCount = articles.filter((a) => a.sentiment === "bullish").length;
      const bearishCount = articles.filter((a) => a.sentiment === "bearish").length;
      const neutralCount = articles.filter((a) => a.sentiment === "neutral").length;

      let overallSentiment = "Neutral";
      if (totalScore > 2) overallSentiment = "Strongly Bullish";
      else if (totalScore > 0) overallSentiment = "Mildly Bullish";
      else if (totalScore < -2) overallSentiment = "Strongly Bearish";
      else if (totalScore < 0) overallSentiment = "Mildly Bearish";

      return {
        symbol,
        overallSentiment,
        totalScore,
        breakdown: {
          bullish: bullishCount,
          bearish: bearishCount,
          neutral: neutralCount,
        },
        articles: articles.map((a) => ({
          title: a.title,
          source: a.source,
          publishedAt: a.pubDate,
          sentiment: a.sentiment,
        })),
        disclaimer:
          "Sentiment is keyword-based and may not reflect actual market conditions. Always verify with fundamental and technical analysis.",
      };
    }),
});

export const globalMarketsTool = tool({
  description:
    "Get prices for global indices (e.g., ^JKSE, ^DJI), Forex, or Commodities (e.g., GC=F).",
  inputSchema: z.object({
    symbols: z
      .array(z.string())
      .describe(
        "e.g. ['^JKSE' (IHSG), 'IDR=X' (USD/IDR), 'GC=F' (Gold), 'CL=F' (Oil)]",
      ),
  }),
  execute: async ({ symbols }) =>
    safe(async () => {
      const finalQuotes: any[] = [];
      for (const s of symbols) {
        const res = await fetchYahooChartQuote(s);
        if (res) finalQuotes.push(res);
      }
      if (finalQuotes.length === 0)
        throw new Error("No data found for symbols");
      return { quotes: finalQuotes };
    }),
});

export const stockScreenerTool = tool({
  description:
    "Screen stocks based on criteria like market cap, P/E ratio, dividend yield, and sector. Returns top matching stocks.",
  inputSchema: z.object({
    criteria: z
      .enum(["large_cap", "mid_cap", "small_cap", "high_dividend", "growth", "value", "momentum"])
      .describe("Screening criteria."),
    region: z.enum(["US", "ID"]).default("US").describe("Market region."),
  }),
  execute: async ({ criteria, region }) =>
    safe(async () => {
      let scrId = "";
      switch (criteria) {
        case "large_cap":
          scrId = "large_cap";
          break;
        case "mid_cap":
          scrId = "mid_cap";
          break;
        case "small_cap":
          scrId = "small_cap";
          break;
        case "high_dividend":
          scrId = "high_dividend";
          break;
        case "growth":
          scrId = "aggressive_small_caps";
          break;
        case "value":
          scrId = "most_actives";
          break;
        case "momentum":
          scrId = "day_gainers";
          break;
      }

      const res = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-US&region=${region}&scrIds=${scrId}&count=10`,
        { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) throw new Error("Failed to fetch screener data");
      const data = await res.json();
      const quotes = data.finance?.result?.[0]?.quotes || [];

      return {
        criteria,
        region,
        count: quotes.length,
        stocks: quotes.map((q: any) => ({
          symbol: q.symbol,
          name: q.shortName || q.longName,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          marketCap: q.marketCap,
          pe: q.trailingPE,
          dividendYield: q.dividendYield,
          volume: q.regularMarketVolume,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow,
        })),
      };
    }),
});

export const earningsCalendarTool = tool({
  description:
    "Get upcoming earnings dates and EPS estimates for a stock. Useful for planning trades around earnings announcements.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock symbol, e.g. 'AAPL' or 'BBCA'."),
  }),
  execute: async ({ symbol }) =>
    safe(async () => {
      let data: any = null;
      for (const v of [symbol, `${symbol}.JK`, `${symbol}.ID`]) {
        try {
          const res = await fetch(
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${v.toUpperCase()}?modules=earningsHistory,calendarEvents`,
            { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) },
          );
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {}
      }

      if (!data) throw new Error("Earnings data not available");

      const summary = data.quoteSummary?.result?.[0];
      const earningsHistory = summary?.earningsHistory?.history || [];
      const calendarEvents = summary?.calendarEvents || {};

      const nextEarningsDate = calendarEvents.earnings?.earningsDate?.[0]?.raw
        ? new Date(calendarEvents.earnings.earningsDate[0].raw * 1000).toISOString()
        : null;

      const earningsSurprise = earningsHistory.map((h: any) => ({
        quarter: h.quarter?.fmt || "N/A",
        epsEstimate: h.epsEstimate?.raw || null,
        epsActual: h.epsActual?.raw || null,
        surprise: h.surprise?.raw || null,
        surprisePercent: h.surprisePercent?.raw || null,
      }));

      return {
        symbol: symbol.toUpperCase(),
        nextEarningsDate,
        earningsEstimate: {
          low: calendarEvents.earnings?.earningsLow?.raw || null,
          high: calendarEvents.earnings?.earningsHigh?.raw || null,
          average: calendarEvents.earnings?.earningsAverage?.raw || null,
          revenueLow: calendarEvents.earnings?.revenueLow?.fmt || null,
          revenueHigh: calendarEvents.earnings?.revenueHigh?.fmt || null,
          revenueAverage: calendarEvents.earnings?.revenueAverage?.fmt || null,
        },
        earningsHistory: earningsSurprise,
        note: "Earnings dates and estimates are subject to change. Verify with official company announcements.",
      };
    }),
});

export const dividendHistoryTool = tool({
  description:
    "Get dividend history and yield information for a stock. Useful for income investors.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock symbol, e.g. 'AAPL' or 'BBCA'."),
  }),
  execute: async ({ symbol }) =>
    safe(async () => {
      let data: any = null;
      for (const v of [symbol, `${symbol}.JK`, `${symbol}.ID`]) {
        try {
          const res = await fetch(
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${v.toUpperCase()}?modules=summaryDetail,defaultKeyStatistics`,
            { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) },
          );
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {}
      }

      if (!data) throw new Error("Dividend data not available");

      const summary = data.quoteSummary?.result?.[0]?.summaryDetail || {};
      const stats = data.quoteSummary?.result?.[0]?.defaultKeyStatistics || {};

      return {
        symbol: symbol.toUpperCase(),
        dividend: {
          yield: summary.dividendYield?.raw || stats.dividendYield?.raw || null,
          rate: summary.dividendRate?.raw || stats.dividendRate?.raw || null,
          exDate: summary.exDividendDate?.fmt || null,
          payoutRatio: stats.payoutRatio?.raw || null,
          fiveYearAvgDividendYield: summary.fiveYearAvgDividendYield?.raw || null,
          trailingAnnualDividendRate: summary.trailingAnnualDividendRate?.raw || null,
          trailingAnnualDividendYield: summary.trailingAnnualDividendYield?.raw || null,
        },
        note: "Dividend data from Yahoo Finance. Ex-dividend dates may vary by exchange.",
      };
    }),
});

export const portfolioManagerTool = tool({
  description:
    "Manage a virtual paper trading portfolio. State is maintained per-call, so AI must manage the JSON.",
  inputSchema: z.object({
    action: z.enum(["buy", "sell", "view"]),
    symbol: z.string().optional(),
    quantity: z.number().optional(),
    price: z.number().optional(),
    currentPortfolio: z
      .any()
      .describe(
        "Pass empty object {} to create new. Must contain 'balance' and 'holdings'.",
      ),
  }),
  execute: async ({ action, symbol, quantity, price, currentPortfolio }) =>
    safe(async () => {
      let portfolio = currentPortfolio || { balance: 100000, holdings: {} };
      if (typeof portfolio === "string") portfolio = JSON.parse(portfolio);
      if (portfolio.balance === undefined) portfolio.balance = 100000;
      if (!portfolio.holdings) portfolio.holdings = {};

      if (action === "buy" && symbol && quantity && price) {
        const cost = quantity * price;
        if (portfolio.balance < cost) throw new Error("Insufficient balance");
        portfolio.balance -= cost;
        const holding = portfolio.holdings[symbol] || {
          quantity: 0,
          averagePrice: 0,
        };
        const totalValue = holding.quantity * holding.averagePrice + cost;
        holding.quantity += quantity;
        holding.averagePrice = totalValue / holding.quantity;
        portfolio.holdings[symbol] = holding;
        return { status: "success", action: "buy", portfolio };
      } else if (action === "sell" && symbol && quantity && price) {
        const holding = portfolio.holdings[symbol];
        if (!holding || holding.quantity < quantity)
          throw new Error("Insufficient holding");
        portfolio.balance += quantity * price;
        holding.quantity -= quantity;
        if (holding.quantity === 0) delete portfolio.holdings[symbol];
        return { status: "success", action: "sell", portfolio };
      }
      return { status: "success", action: "view", portfolio };
    }),
});

export const chartControlTool = tool({
  description:
    "Control the stock chart display. Change chart type, timeframe, and toggle technical indicators on/off. This tool modifies the interactive chart that the user can see.",
  inputSchema: z.object({
    action: z
      .enum(["setChartType", "setTimeframe", "toggleIndicator", "getState"])
      .describe("Action to perform on the chart."),
    chartType: z
      .enum(["candlestick", "line", "area", "bar"])
      .optional()
      .describe("Chart type to set."),
    timeframe: z
      .enum(["1D", "1W", "1M", "3M", "6M", "1Y", "YTD"])
      .optional()
      .describe("Timeframe to set."),
    indicator: z
      .enum([
        "sma20",
        "sma50",
        "sma200",
        "ema12",
        "ema26",
        "bollinger",
        "vwap",
        "volume",
      ])
      .optional()
      .describe("Indicator to toggle on/off."),
  }),
  execute: async ({ action, chartType, timeframe, indicator }) =>
    safe(async () => {
      if (action === "setChartType" && chartType) {
        return {
          action: "setChartType",
          chartType,
          message: `Chart type changed to ${chartType}. The chart will update automatically.`,
        };
      }

      if (action === "setTimeframe" && timeframe) {
        return {
          action: "setTimeframe",
          timeframe,
          message: `Timeframe changed to ${timeframe}. The chart will reload data.`,
        };
      }

      if (action === "toggleIndicator" && indicator) {
        return {
          action: "toggleIndicator",
          indicator,
          message: `Indicator ${indicator} toggled. The chart will update to show/hide the indicator.`,
        };
      }

      if (action === "getState") {
        return {
          action: "getState",
          message:
            "Chart state retrieved. Use setChartType, setTimeframe, or toggleIndicator to modify the chart.",
        };
      }

      return { error: "Invalid action or missing parameters." };
    }),
});

export const chartDrawTool = tool({
  description:
    "Draw on the stock chart. Add trendlines, horizontal support/resistance lines, or clear all drawings. This helps visualize key price levels and patterns.",
  inputSchema: z.object({
    action: z
      .enum(["addTrendline", "addHorizontalLine", "clearDrawings"])
      .describe("Drawing action to perform."),
    trendline: z
      .object({
        startTime: z.string().describe("Start time in ISO format or YYYY-MM-DD"),
        startPrice: z.number().describe("Start price level"),
        endTime: z.string().describe("End time in ISO format or YYYY-MM-DD"),
        endPrice: z.number().describe("End price level"),
        color: z.string().default("#2196f3").describe("Line color (hex)"),
        width: z.number().default(2).describe("Line width (1-4)"),
      })
      .optional()
      .describe("Trendline data for addTrendline action."),
    horizontalLine: z
      .object({
        price: z.number().describe("Price level for the horizontal line"),
        label: z.string().describe("Label for the line (e.g., 'Support', 'Resistance')"),
        color: z.string().default("#ff9800").describe("Line color (hex)"),
        width: z.number().default(1).describe("Line width (1-4)"),
        style: z.enum(["solid", "dashed"]).default("dashed").describe("Line style"),
      })
      .optional()
      .describe("Horizontal line data for addHorizontalLine action."),
  }),
  execute: async ({ action, trendline, horizontalLine }) =>
    safe(async () => {
      if (action === "addTrendline" && trendline) {
        const id = `tl-${Date.now()}`;
        return {
          action: "addTrendline",
          id,
          trendline: {
            ...trendline,
            id,
            startTime: new Date(trendline.startTime).getTime() / 1000,
            endTime: new Date(trendline.endTime).getTime() / 1000,
          },
          message: `Trendline added from ${trendline.startTime} ($${trendline.startPrice}) to ${trendline.endTime} ($${trendline.endPrice}).`,
        };
      }

      if (action === "addHorizontalLine" && horizontalLine) {
        const id = `hl-${Date.now()}`;
        return {
          action: "addHorizontalLine",
          id,
          horizontalLine: {
            ...horizontalLine,
            id,
          },
          message: `Horizontal line added at $${horizontalLine.price} (${horizontalLine.label}).`,
        };
      }

      if (action === "clearDrawings") {
        return {
          action: "clearDrawings",
          message: "All drawings cleared from the chart.",
        };
      }

      return { error: "Invalid action or missing parameters." };
    }),
});

export const createOrbitTools = async (
  cfg: any = {},
  mcpClients: any[] = [],
) => {
  const normalizeMcpArgs = (input: unknown) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {} as Record<string, unknown>;
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) out[key] = trimmed;
      } else if (value !== undefined && value !== null) {
        out[key] = value;
      }
    }
    return out;
  };

  const extractRequiredStringFields = (schema: unknown): string[] => {
    if (!schema || typeof schema !== "object") return [];
    const maybe = schema as {
      required?: unknown;
      properties?: Record<string, { type?: unknown }>;
    };
    const required = Array.isArray(maybe.required) ? maybe.required : [];
    const properties =
      maybe.properties && typeof maybe.properties === "object"
        ? maybe.properties
        : {};
    return required.filter((field): field is string => {
      if (typeof field !== "string") return false;
      const prop = properties[field];
      return !!prop && prop.type === "string";
    });
  };

  const readSkillTool = tool({
    description: "Read the full instructions of a specific skill by its name.",
    inputSchema: z.object({
      skillName: z.string().describe("The exact name of the skill to read."),
    }),
    execute: async ({ skillName }) => {
      const skills = cfg.skills || [];
      const skill = skills.find(
        (s: any) => s.name.toLowerCase() === skillName.toLowerCase(),
      );
      if (!skill) return { error: `Skill '${skillName}' not found.` };
      return { skillName: skill.name, content: skill.content };
    },
  });

  const saveMemoryTool = tool({
    description:
      "Save a personalized fact or preference about the user into your long-term memory. Use this whenever the user shares personal details, preferences, or explicitly asks you to remember something.",
    inputSchema: z.object({
      fact: z
        .string()
        .describe(
          "The fact to remember. Write it in third person (e.g., 'User lives in Jakarta', 'User prefers concise answers').",
        ),
    }),
    execute: async ({ fact }) => {
      // The actual saving happens in the frontend interceptor, so we just return success
      return {
        savedFact: fact,
        note: "Memory saved successfully. Do not mention this to the user.",
      };
    },
  });

  const baseTools: Record<string, any> = {
    weather: weatherTool,
    stockQuote: stockQuoteTool,
    stockHistory: stockHistoryTool,
    stockTechnicalAnalysis: stockTechnicalAnalysisTool,
    marketMovers: marketMoversTool,
    cryptoTracker: cryptoTrackerTool,
    riskCalculator: riskCalculatorTool,
    fundamentalAnalysis: fundamentalAnalysisTool,
    globalMarkets: globalMarketsTool,
    portfolioManager: portfolioManagerTool,
    financialSentiment: financialSentimentTool,
    stockScreener: stockScreenerTool,
    earningsCalendar: earningsCalendarTool,
    dividendHistory: dividendHistoryTool,
    chartControl: chartControlTool,
    chartDraw: chartDrawTool,
    newsSearch: newsSearchTool,
    webSearch: tool({
      description: "Search web.",
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().default(8),
      }),
      execute: async ({ query, limit }) =>
        safe(async () => ({
          query,
          results: await makeWebSearch(cfg)(query, limit),
        })),
    }),
    webFetch: tool({
      description: "Fetch web.",
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) =>
        safe(async () => ({
          url,
          content: (await (await fetch(url)).text())
            .replace(/<[^>]+>/g, " ")
            .trim()
            .slice(0, 12000),
        })),
    }),
    currency: currencyTool,
    wikipedia: wikipediaTool,
    datetime: datetimeTool,
    calculator: calculatorTool,
    readSkill: readSkillTool,
    saveMemory: saveMemoryTool,
    youtubeMusic: youtubeMusicTool,
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
              const normalizedArgs = normalizeMcpArgs(args);
              const requiredStringFields = extractRequiredStringFields(
                mcpTool.inputSchema,
              );
              const missingRequired = requiredStringFields.filter((field) => {
                const value = normalizedArgs[field];
                return typeof value !== "string" || value.trim().length === 0;
              });
              if (missingRequired.length > 0) {
                return {
                  error: `MCP tool '${mcpTool.name}' requires: ${missingRequired.join(", ")}.`,
                  missingFields: missingRequired,
                  suggestion:
                    "Provide the missing required argument(s) before retrying.",
                };
              }

              const result = await client.callTool({
                name: mcpTool.name,
                arguments: normalizedArgs,
              });
              return result;
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              if (
                /null or undefined query/i.test(message) ||
                /passed a null or undefined query/i.test(message)
              ) {
                return {
                  error: `MCP tool '${mcpTool.name}' failed because 'query' is empty.`,
                  suggestion:
                    "Retry with a non-empty 'query' argument that matches the tool schema.",
                };
              }
              return { error: message };
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
