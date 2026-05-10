import { tool } from "ai";
import { z } from "zod";

/**
 * Tool set exposed to the model. Each tool returns a strongly-typed payload
 * that the client UI can render as a card.
 *
 * All external APIs used here are keyless and commonly reachable from a
 * Node runtime. Errors are caught and returned as { error } so the model
 * can gracefully fall back to plain text.
 */

const safe = async <T>(
  fn: () => Promise<T>,
): Promise<T | { error: string }> => {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return { error: message };
  }
};

// ---------- Weather ----------

const weatherCodeMap: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "sun" },
  1: { label: "Mainly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "cloud-sun" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Fog", icon: "cloud-fog" },
  48: { label: "Depositing rime fog", icon: "cloud-fog" },
  51: { label: "Light drizzle", icon: "cloud-drizzle" },
  53: { label: "Moderate drizzle", icon: "cloud-drizzle" },
  55: { label: "Dense drizzle", icon: "cloud-drizzle" },
  61: { label: "Light rain", icon: "cloud-rain" },
  63: { label: "Moderate rain", icon: "cloud-rain" },
  65: { label: "Heavy rain", icon: "cloud-rain" },
  71: { label: "Light snow", icon: "cloud-snow" },
  73: { label: "Moderate snow", icon: "cloud-snow" },
  75: { label: "Heavy snow", icon: "cloud-snow" },
  80: { label: "Rain showers", icon: "cloud-rain" },
  81: { label: "Heavy showers", icon: "cloud-rain" },
  82: { label: "Violent showers", icon: "cloud-rain" },
  95: { label: "Thunderstorm", icon: "cloud-lightning" },
  96: { label: "Thunderstorm with hail", icon: "cloud-lightning" },
  99: { label: "Severe thunderstorm", icon: "cloud-lightning" },
};

type GeocodingResult = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

const geocode = async (query: string): Promise<GeocodingResult> => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
  const json = (await res.json()) as {
    results?: GeocodingResult[];
  };
  const first = json.results?.[0];
  if (!first) throw new Error(`No location found for "${query}".`);
  return first;
};

export const weatherTool = tool({
  description:
    "Get current weather and a 7-day forecast for a city or place name. Supports places worldwide, Indonesian cities included.",
  inputSchema: z.object({
    location: z
      .string()
      .describe("City name, e.g. 'Jakarta', 'Bandung', 'Tokyo'."),
  }),
  execute: async ({ location }) =>
    safe(async () => {
      const place = await geocode(location);
      const params = new URLSearchParams({
        latitude: place.latitude.toString(),
        longitude: place.longitude.toString(),
        current:
          "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        timezone: place.timezone ?? "auto",
        forecast_days: "7",
      });
      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API returned ${res.status}.`);
      const data = (await res.json()) as {
        current: {
          temperature_2m: number;
          apparent_temperature: number;
          relative_humidity_2m: number;
          wind_speed_10m: number;
          weather_code: number;
          is_day: number;
        };
        current_units: Record<string, string>;
        daily: {
          time: string[];
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_sum: number[];
        };
      };
      const code = data.current.weather_code;
      const summary = weatherCodeMap[code] ?? {
        label: "Unknown",
        icon: "cloud",
      };
      return {
        place: {
          name: place.name,
          country: place.country ?? null,
          region: place.admin1 ?? null,
        },
        current: {
          temperatureC: data.current.temperature_2m,
          feelsLikeC: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          windSpeedKmh: data.current.wind_speed_10m,
          weatherCode: code,
          condition: summary.label,
          icon: summary.icon,
          isDay: data.current.is_day === 1,
        },
        daily: data.daily.time.map((date, i) => ({
          date,
          weatherCode: data.daily.weather_code[i],
          condition:
            weatherCodeMap[data.daily.weather_code[i]]?.label ?? "Unknown",
          tempMaxC: data.daily.temperature_2m_max[i],
          tempMinC: data.daily.temperature_2m_min[i],
          precipitationMm: data.daily.precipitation_sum[i],
        })),
      };
    }),
});

// ---------- Stock (Yahoo Finance) ----------

type YahooChartMeta = {
  currency?: string;
  symbol: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
};

type YahooChartResult = {
  meta: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
};

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Sparks are the lightweight quote endpoint. It serves meta + intraday
 * prices for multiple symbols at once, doesn't require cookie/crumb auth,
 * and covers IDX, NYSE, NASDAQ, crypto, FX, and indices uniformly.
 *
 * We fall back between query1 and query2 and finally to an authed request
 * with the cookie+crumb dance, which sometimes dodges IP-level rate limits.
 */
type YahooSparkMeta = {
  currency?: string;
  symbol: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
};

type YahooSparkResponse = {
  spark?: {
    result?: Array<{
      symbol: string;
      response?: Array<{
        meta: YahooSparkMeta;
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
    }>;
    error?: { description?: string };
  };
};

// Stateless auth: spark usually doesn't need cookies. We keep the cookie
// dance only as a last-resort fallback for /v8/chart.
type YahooCreds = { cookie: string; crumb: string };
let yahooCreds: YahooCreds | null = null;
let yahooCredsAt = 0;
const YAHOO_CREDS_TTL_MS = 55 * 60_000;

const refreshYahooCreds = async (): Promise<YahooCreds> => {
  const seed = await fetch("https://fc.yahoo.com/", {
    headers: YAHOO_HEADERS,
    redirect: "follow",
  });
  const rawCookies = seed.headers.getSetCookie?.() ?? [];
  const cookiePairs = rawCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookiePairs) throw new Error("Yahoo: could not obtain consent cookie.");
  const crumbRes = await fetch(
    "https://query1.finance.yahoo.com/v1/test/getcrumb",
    { headers: { ...YAHOO_HEADERS, Cookie: cookiePairs } },
  );
  const crumb = (await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb)
    throw new Error(`Yahoo: getcrumb returned ${crumbRes.status}.`);
  return { cookie: cookiePairs, crumb };
};

const getYahooCreds = async (force = false): Promise<YahooCreds> => {
  if (!force && yahooCreds && Date.now() - yahooCredsAt < YAHOO_CREDS_TTL_MS) {
    return yahooCreds;
  }
  yahooCreds = await refreshYahooCreds();
  yahooCredsAt = Date.now();
  return yahooCreds;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ringan dan toleran 429: coba dua host, pakai fetch anonim dulu, baru auth
 * kalau perlu. Tiap percobaan ada small jitter delay supaya tidak burst.
 */
const yahooFetchWithRetry = async (path: string): Promise<Response> => {
  const hosts = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
  ];
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const host of hosts) {
      try {
        const url = new URL(`${host}${path}`);
        let res = await fetch(url, { headers: YAHOO_HEADERS });
        if (res.status === 429 || res.status === 401 || res.status === 403) {
          // Try again with authed cookie+crumb.
          const creds = await getYahooCreds(attempt > 0);
          const authedUrl = new URL(url.toString());
          authedUrl.searchParams.set("crumb", creds.crumb);
          res = await fetch(authedUrl, {
            headers: { ...YAHOO_HEADERS, Cookie: creds.cookie },
          });
        }
        if (res.status === 429) {
          lastError = new Error(`${host} returned 429.`);
          continue;
        }
        if (!res.ok) throw new Error(`${host} returned ${res.status}.`);
        return res;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    // Exponential backoff with small jitter.
    await sleep(200 * (attempt + 1) + Math.random() * 150);
  }
  throw lastError ?? new Error("Yahoo Finance unreachable.");
};

const yahooSpark = async (
  symbols: string[],
): Promise<Map<string, YahooSparkMeta>> => {
  const qs = new URLSearchParams({
    symbols: symbols.join(","),
    range: "1d",
    interval: "5m",
    indicators: "close",
    includeTimestamps: "false",
    includePrePost: "false",
  });
  const res = await yahooFetchWithRetry(`/v7/finance/spark?${qs.toString()}`);
  const json = (await res.json()) as YahooSparkResponse;
  if (json.spark?.error) {
    throw new Error(json.spark.error.description ?? "Yahoo spark error");
  }
  const out = new Map<string, YahooSparkMeta>();
  for (const row of json.spark?.result ?? []) {
    const meta = row.response?.[0]?.meta;
    if (meta?.symbol) out.set(meta.symbol.toUpperCase(), meta);
  }
  return out;
};

/**
 * Historical bars (daily/weekly/monthly). Anonymous fetch works for most
 * users; authed is used as fallback.
 */
const yahooChart = async (
  symbol: string,
  params: Record<string, string> = {},
): Promise<YahooChartResult> => {
  const qs = new URLSearchParams({
    includePrePost: "false",
    ...params,
  });
  const res = await yahooFetchWithRetry(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?${qs.toString()}`,
  );
  const json = (await res.json()) as {
    chart?: {
      result?: YahooChartResult[];
      error?: { description?: string };
    };
  };
  if (json.chart?.error) {
    throw new Error(json.chart.error.description ?? "Yahoo chart error");
  }
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No data returned for ${symbol}.`);
  return result;
};

type QuoteRow = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  currency: string | null;
  exchange: string | null;
  source: "yahoo" | "stooq";
};

type HistoryPoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

type HistoryRow = {
  symbol: string;
  currency: string | null;
  exchange: string | null;
  range: string;
  interval: string;
  stats: {
    first: number | null;
    last: number | null;
    min: number | null;
    max: number | null;
    changePercent: number | null;
    points: number;
  };
  points: HistoryPoint[];
  source: "yahoo" | "stooq";
};

// Agressive cache so repeated prompts don't hammer Yahoo. The quote TTL
// is longer than a trading tick on purpose — we trade a few minutes of
// staleness for orders of magnitude fewer 429s.
const QUOTE_CACHE = new Map<string, { at: number; data: QuoteRow }>();
const HISTORY_CACHE = new Map<string, { at: number; data: HistoryRow }>();
const QUOTE_TTL_MS = 5 * 60_000;
const HISTORY_TTL_MS = 60 * 60_000;

// Stooq uses lowercase symbols with country suffixes.
const toStooqSymbol = (sym: string): string => {
  const lower = sym.toLowerCase();
  if (lower.includes(".")) return lower;
  if (lower.includes("-")) return lower;
  return `${lower}.us`;
};

const parseCsv = (text: string): string[][] =>
  text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));

const parseNumber = (value: string | undefined): number | null => {
  if (!value || value === "N/D") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Fallback quote provider: Stooq CSV. Free, no key, but coverage outside
 *  US/EU is patchy — IDX tickers in particular return N/D for all fields. */
const stooqQuote = async (symbol: string): Promise<QuoteRow> => {
  const stooqSym = toStooqSymbol(symbol);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcvn&h&e=csv`;
  const res = await fetch(url, {
    headers: { ...YAHOO_HEADERS, Accept: "text/csv,text/plain,*/*" },
  });
  if (!res.ok) throw new Error(`Stooq returned ${res.status}.`);
  const rows = parseCsv(await res.text());
  const [, data] = rows;
  if (!data || data.length < 7) {
    throw new Error(`Stooq has no data for ${symbol}.`);
  }
  // Columns (f=sd2t2ohlcvn): Symbol,Date,Time,Open,High,Low,Close,Volume,Name
  const [, , , open, high, low, close, volume, name] = data;
  // Stooq returns "N/D" in every field when the symbol isn't tracked.
  if (close === "N/D" || data.every((c) => c === "N/D" || c === symbol)) {
    throw new Error(`Stooq has no data for ${symbol}.`);
  }
  const price = parseNumber(close);
  const dayHigh = parseNumber(high);
  const dayLow = parseNumber(low);
  const openVal = parseNumber(open);
  const previousClose = openVal;
  const change =
    price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent =
    change !== null && previousClose ? (change / previousClose) * 100 : null;
  const upper = symbol.toUpperCase();
  const currency = upper.endsWith(".JK")
    ? "IDR"
    : upper.includes("-") || upper.endsWith(".US") || !upper.includes(".")
      ? "USD"
      : null;
  const exchange = upper.endsWith(".JK") ? "Jakarta (IDX)" : null;

  return {
    symbol: upper,
    name: name?.trim() || upper,
    price,
    change,
    changePercent,
    previousClose,
    dayHigh,
    dayLow,
    volume: parseNumber(volume),
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    currency,
    exchange,
    source: "stooq",
  };
};

const stooqInterval = (interval: string): string => {
  switch (interval) {
    case "1wk":
      return "w";
    case "1mo":
      return "m";
    default:
      return "d";
  }
};

const rangeToDays = (range: string): number | null => {
  switch (range) {
    case "1mo":
      return 31;
    case "3mo":
      return 93;
    case "6mo":
      return 186;
    case "1y":
      return 366;
    case "2y":
      return 732;
    case "5y":
      return 1830;
    case "ytd": {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return Math.ceil(
        (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
      );
    }
    default:
      return null;
  }
};

/** Fallback historical provider: Stooq CSV daily/weekly/monthly bars. */
const stooqHistory = async (
  symbol: string,
  range: string,
  interval: string,
): Promise<HistoryRow> => {
  const stooqSym = toStooqSymbol(symbol);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=${stooqInterval(interval)}`;
  const res = await fetch(url, {
    headers: { ...YAHOO_HEADERS, Accept: "text/csv,text/plain,*/*" },
  });
  if (!res.ok) throw new Error(`Stooq returned ${res.status}.`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error(`Stooq has no history for ${symbol}.`);
  const [header, ...data] = rows;
  const idx = {
    date: header.indexOf("Date"),
    open: header.indexOf("Open"),
    high: header.indexOf("High"),
    low: header.indexOf("Low"),
    close: header.indexOf("Close"),
    volume: header.indexOf("Volume"),
  };
  let points: HistoryPoint[] = data
    .filter((row) => row.length >= 5)
    .map((row) => ({
      date: row[idx.date],
      open: parseNumber(row[idx.open]),
      high: parseNumber(row[idx.high]),
      low: parseNumber(row[idx.low]),
      close: parseNumber(row[idx.close]),
      volume: idx.volume >= 0 ? parseNumber(row[idx.volume]) : null,
    }))
    .filter((p) => p.close !== null);

  const days = rangeToDays(range);
  if (days !== null && points.length > 0) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    points = points.filter((p) => new Date(p.date).getTime() >= cutoff);
  }

  const closes = points
    .map((p) => p.close)
    .filter((x): x is number => typeof x === "number");
  const first = closes[0] ?? null;
  const last = closes[closes.length - 1] ?? null;
  const min = closes.length ? Math.min(...closes) : null;
  const max = closes.length ? Math.max(...closes) : null;
  const changePct = first && last ? ((last - first) / first) * 100 : null;

  const upper = symbol.toUpperCase();
  const currency = upper.endsWith(".JK") ? "IDR" : null;
  const exchange = upper.endsWith(".JK") ? "Jakarta (IDX)" : null;

  return {
    symbol: upper,
    currency,
    exchange,
    range,
    interval,
    stats: {
      first,
      last,
      min,
      max,
      changePercent: changePct,
      points: points.length,
    },
    points,
    source: "stooq",
  };
};

const quoteFromSpark = (
  meta: YahooSparkMeta,
  fallbackSymbol: string,
): QuoteRow => {
  const price = meta.regularMarketPrice ?? null;
  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
  const change =
    price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent =
    change !== null && previousClose ? (change / previousClose) * 100 : null;
  return {
    symbol: meta.symbol ?? fallbackSymbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol ?? fallbackSymbol,
    price,
    change,
    changePercent,
    previousClose,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    source: "yahoo",
  };
};

/**
 * Wrap Yahoo + Stooq behind a single cached fetch. Cache hits bypass both
 * providers, preventing Yahoo 429 cascades when the model re-queries the
 * same ticker across reasoning steps.
 *
 * For quotes we batch all uncached symbols into one /v7/quote call so
 * N tickers cost 1 HTTP hit instead of N.
 */
const fetchQuotes = async (
  symbols: string[],
): Promise<Array<QuoteRow & { error?: string }>> => {
  const now = Date.now();
  const ordered: Array<{
    sym: string;
    result?: QuoteRow;
    error?: string;
  }> = symbols.map((sym) => ({ sym }));

  const toFetch: string[] = [];
  ordered.forEach((slot) => {
    const key = slot.sym.toUpperCase();
    const cached = QUOTE_CACHE.get(key);
    if (cached && now - cached.at < QUOTE_TTL_MS) {
      slot.result = cached.data;
    } else {
      toFetch.push(slot.sym);
    }
  });

  if (toFetch.length > 0) {
    let metaByUpper = new Map<string, YahooSparkMeta>();
    let yahooError: Error | null = null;
    try {
      metaByUpper = await yahooSpark(toFetch);
    } catch (error) {
      yahooError = error instanceof Error ? error : new Error(String(error));
    }

    for (const slot of ordered) {
      if (slot.result) continue;
      const key = slot.sym.toUpperCase();
      const meta = metaByUpper.get(key);
      if (meta) {
        const row = quoteFromSpark(meta, slot.sym);
        QUOTE_CACHE.set(key, { at: now, data: row });
        slot.result = row;
        continue;
      }
      try {
        const row = await stooqQuote(slot.sym);
        QUOTE_CACHE.set(key, { at: now, data: row });
        slot.result = row;
      } catch (stooqError) {
        const yMsg =
          yahooError instanceof Error
            ? yahooError.message
            : "no yahoo data for this symbol";
        const sMsg =
          stooqError instanceof Error ? stooqError.message : String(stooqError);
        slot.error = `Yahoo: ${yMsg} · Stooq: ${sMsg}`;
      }
    }
  }

  return ordered.map((slot) => {
    if (slot.result) return slot.result;
    return {
      symbol: slot.sym.toUpperCase(),
      name: slot.sym.toUpperCase(),
      price: null,
      change: null,
      changePercent: null,
      previousClose: null,
      dayHigh: null,
      dayLow: null,
      volume: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      currency: null,
      exchange: null,
      source: "yahoo" as const,
      error: slot.error ?? "Quote unavailable.",
    };
  });
};

const fetchHistory = async (
  symbol: string,
  range: string,
  interval: string,
): Promise<HistoryRow> => {
  const key = `${symbol.toUpperCase()}|${range}|${interval}`;
  const cached = HISTORY_CACHE.get(key);
  if (cached && Date.now() - cached.at < HISTORY_TTL_MS) {
    return cached.data;
  }

  let row: HistoryRow;
  try {
    const series = await yahooChart(symbol, { range, interval });
    const quote = series.indicators?.quote?.[0];
    const timestamps = series.timestamp ?? [];
    const points: HistoryPoint[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open: quote?.open?.[i] ?? null,
        high: quote?.high?.[i] ?? null,
        low: quote?.low?.[i] ?? null,
        close: quote?.close?.[i] ?? null,
        volume: quote?.volume?.[i] ?? null,
      }))
      .filter((p) => p.close !== null);
    const closes = points
      .map((p) => p.close)
      .filter((x): x is number => typeof x === "number");
    const first = closes[0] ?? null;
    const last = closes[closes.length - 1] ?? null;
    const min = closes.length ? Math.min(...closes) : null;
    const max = closes.length ? Math.max(...closes) : null;
    const changePct = first && last ? ((last - first) / first) * 100 : null;
    row = {
      symbol: series.meta.symbol,
      currency: series.meta.currency ?? null,
      exchange:
        series.meta.fullExchangeName ?? series.meta.exchangeName ?? null,
      range,
      interval,
      stats: {
        first,
        last,
        min,
        max,
        changePercent: changePct,
        points: points.length,
      },
      points,
      source: "yahoo",
    };
  } catch (yahooError) {
    try {
      row = await stooqHistory(symbol, range, interval);
    } catch (stooqError) {
      const yMsg =
        yahooError instanceof Error ? yahooError.message : String(yahooError);
      const sMsg =
        stooqError instanceof Error ? stooqError.message : String(stooqError);
      throw new Error(`Yahoo: ${yMsg} · Stooq: ${sMsg}`);
    }
  }

  HISTORY_CACHE.set(key, { at: Date.now(), data: row });
  return row;
};

export const stockQuoteTool = tool({
  description:
    "Get the latest quote for one or more stock tickers. For Indonesian stocks on IDX, append '.JK' (e.g. BBCA.JK, TLKM.JK). Works for US tickers (AAPL, MSFT), crypto (BTC-USD), and indices (^JKSE). Data from Yahoo Finance with Stooq fallback.",
  inputSchema: z.object({
    symbols: z
      .array(z.string())
      .min(1)
      .max(10)
      .describe(
        "List of tickers. Use .JK suffix for IDX stocks (e.g. 'BBCA.JK').",
      ),
  }),
  execute: async ({ symbols }) =>
    safe(async () => {
      const rows = await fetchQuotes(symbols);
      return { quotes: rows };
    }),
});

export const stockHistoryTool = tool({
  description:
    "Get historical OHLC prices for a single ticker. Useful for technical analysis or charting. Use .JK suffix for Indonesian stocks. Data from Yahoo Finance with Stooq fallback.",
  inputSchema: z.object({
    symbol: z.string().describe("Ticker symbol, e.g. 'BBCA.JK', 'AAPL'."),
    range: z
      .enum(["1mo", "3mo", "6mo", "1y", "2y", "5y", "ytd", "max"])
      .default("3mo"),
    interval: z.enum(["1d", "1wk", "1mo"]).default("1d"),
  }),
  execute: async ({ symbol, range, interval }) =>
    safe(async () => fetchHistory(symbol, range, interval)),
});

// ---------- News (Google News RSS) ----------

const decodeEntities = (str: string) =>
  str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );

const stripHtml = (str: string) => decodeEntities(str.replace(/<[^>]*>/g, ""));

export const newsSearchTool = tool({
  description:
    "Search recent news headlines for a query. Returns titles, sources, and publication dates. Useful for sentiment and context.",
  inputSchema: z.object({
    query: z.string().describe("Search query, e.g. 'BBCA saham', 'Tesla'."),
    language: z.string().default("en").describe("hl code, e.g. 'en', 'id'."),
    country: z.string().default("US").describe("gl code, e.g. 'US', 'ID'."),
    limit: z.number().int().min(1).max(15).default(8),
  }),
  execute: async ({ query, language, country, limit }) =>
    safe(async () => {
      const params = new URLSearchParams({
        q: query,
        hl: language,
        gl: country,
        ceid: `${country}:${language}`,
      });
      const url = `https://news.google.com/rss/search?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; orbit-agent/1.0; +https://example.com)",
          Accept: "application/rss+xml, application/xml",
        },
      });
      if (!res.ok) throw new Error(`Google News returned ${res.status}.`);
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
        .slice(0, limit)
        .map((match) => {
          const block = match[1];
          const pick = (tag: string) => {
            const m = new RegExp(
              `<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
              "i",
            ).exec(block);
            if (!m) return null;
            const raw = m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "");
            return stripHtml(raw).trim();
          };
          return {
            title: pick("title") ?? "",
            link: pick("link") ?? "",
            source: pick("source") ?? "",
            publishedAt: pick("pubDate") ?? "",
            description: (pick("description") ?? "").slice(0, 400),
          };
        })
        .filter((item) => item.title);
      return {
        query,
        articles: items,
      };
    }),
});

// ---------- Currency ----------

export const currencyTool = tool({
  description:
    "Convert an amount between two currencies using ECB daily reference rates.",
  inputSchema: z.object({
    from: z.string().length(3).describe("ISO 4217 code, e.g. 'USD', 'IDR'."),
    to: z.string().length(3).describe("ISO 4217 code, e.g. 'USD', 'IDR'."),
    amount: z.number().positive().default(1),
  }),
  execute: async ({ from, to, amount }) =>
    safe(async () => {
      const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Frankfurter returned ${res.status}.`);
      const json = (await res.json()) as {
        amount: number;
        base: string;
        date: string;
        rates: Record<string, number>;
      };
      const targetKey = to.toUpperCase();
      const converted = json.rates[targetKey];
      if (typeof converted !== "number") {
        throw new Error(`No rate for ${targetKey}.`);
      }
      return {
        from: json.base,
        to: targetKey,
        amount: json.amount,
        rate: converted / json.amount,
        converted,
        date: json.date,
      };
    }),
});

// ---------- Wikipedia ----------

export const wikipediaTool = tool({
  description:
    "Look up a concise summary of a topic from Wikipedia. Useful for background research.",
  inputSchema: z.object({
    query: z.string().describe("Topic to search for."),
    language: z.string().default("en").describe("Wikipedia language code."),
  }),
  execute: async ({ query, language }) =>
    safe(async () => {
      const searchUrl = `https://${language}.wikipedia.org/w/api.php?action=opensearch&limit=1&format=json&search=${encodeURIComponent(query)}&origin=*`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok)
        throw new Error(`Wikipedia search returned ${searchRes.status}.`);
      const search = (await searchRes.json()) as unknown[];
      const titles = Array.isArray(search[1]) ? (search[1] as string[]) : [];
      if (titles.length === 0)
        throw new Error(`No Wikipedia page for "${query}".`);
      const title = titles[0];

      const summaryUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: { Accept: "application/json" },
      });
      if (!summaryRes.ok)
        throw new Error(`Wikipedia summary returned ${summaryRes.status}.`);
      const summary = (await summaryRes.json()) as {
        title: string;
        description?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
        thumbnail?: { source?: string };
      };
      return {
        title: summary.title,
        description: summary.description ?? null,
        extract: summary.extract ?? "",
        url: summary.content_urls?.desktop?.page ?? null,
        thumbnail: summary.thumbnail?.source ?? null,
      };
    }),
});

// ---------- Datetime ----------

export const datetimeTool = tool({
  description:
    "Get the current date and time. Optionally specify an IANA timezone (e.g. 'Asia/Jakarta', 'America/New_York').",
  inputSchema: z.object({
    timezone: z.string().optional(),
  }),
  execute: async ({ timezone }) =>
    safe(async () => {
      const tz = timezone ?? "UTC";
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return {
        timezone: tz,
        iso: now.toISOString(),
        formatted: formatter.format(now),
        epoch: Math.floor(now.getTime() / 1000),
      };
    }),
});

// ---------- Calculator ----------

/** Very small safe math evaluator using Function with a restricted whitelist. */
const evaluateExpression = (expr: string): number => {
  const clean = expr.replace(/\s+/g, "");
  if (!/^[-+*/().,%^\d\w]+$/.test(clean)) {
    throw new Error("Expression contains unsupported characters.");
  }
  const allowed =
    /^(\d|\.|\+|-|\*|\/|\(|\)|,|%|\^|PI|E|sqrt|pow|log|exp|abs|min|max|sin|cos|tan|round|floor|ceil)+$/;
  if (!allowed.test(clean)) {
    throw new Error("Expression uses an unsupported identifier.");
  }
  const compiled = clean
    .replace(/\^/g, "**")
    .replace(/\bPI\b/g, "Math.PI")
    .replace(/\bE\b/g, "Math.E")
    .replace(
      /\b(sqrt|pow|log|exp|abs|min|max|sin|cos|tan|round|floor|ceil)\b/g,
      "Math.$1",
    );
  // Execute in an isolated function scope.
  const fn = new Function(`"use strict"; return (${compiled});`);
  const result = fn() as unknown;
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Expression did not evaluate to a finite number.");
  }
  return result;
};

export const calculatorTool = tool({
  description:
    "Evaluate a mathematical expression. Supports +, -, *, /, %, ^, parentheses, PI, E, and Math functions: sqrt, pow, log, exp, abs, min, max, sin, cos, tan, round, floor, ceil.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("Expression, e.g. '2 * (3 + 4)' or 'sqrt(144)'."),
  }),
  execute: async ({ expression }) =>
    safe(async () => ({
      expression,
      result: evaluateExpression(expression),
    })),
});

// ---------- Web search + fetch ----------

type DuckDuckGoResult = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * DuckDuckGo's HTML endpoint returns keyless search results. We parse the
 * minimal result list shape — brittle if DDG reshuffles markup, but good
 * enough as a default search tool without requiring an API key.
 */
const duckduckgoSearch = async (
  query: string,
  limit: number,
): Promise<DuckDuckGoResult[]> => {
  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent": YAHOO_HEADERS["User-Agent"],
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
  );
  if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}.`);
  const html = await res.text();
  const results: DuckDuckGoResult[] = [];
  const regex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const rawUrl = match[1];
    // DuckDuckGo wraps links in a redirector: /l/?uddg=<encoded>
    let url = rawUrl;
    try {
      if (rawUrl.startsWith("/") || rawUrl.startsWith("//")) {
        const u = new URL(
          rawUrl.startsWith("//")
            ? `https:${rawUrl}`
            : `https://duckduckgo.com${rawUrl}`,
        );
        const uddg = u.searchParams.get("uddg");
        if (uddg) url = decodeURIComponent(uddg);
      }
    } catch {
      // keep rawUrl
    }
    const title = stripHtml(match[2]).trim();
    const snippet = stripHtml(match[3]).trim();
    if (!title || !url) continue;
    results.push({ title, url, snippet });
    if (results.length >= limit) break;
  }
  return results;
};

export const webSearchTool = tool({
  description:
    "Search the open web for up-to-date information. Returns a list of titles, URLs, and short snippets. Use this for current events or anything post-training cutoff.",
  inputSchema: z.object({
    query: z.string().describe("Search query."),
    limit: z.number().int().min(1).max(15).default(8),
  }),
  execute: async ({ query, limit }) =>
    safe(async () => {
      const results = await duckduckgoSearch(query, limit);
      return { query, results };
    }),
});

/**
 * Fetch a URL's plain-text content so the model can read a page found via
 * webSearch. Strips HTML and truncates to keep the response compact.
 */
const MAX_FETCH_BYTES = 500_000;
const MAX_TEXT_LENGTH = 12_000;

export const webFetchTool = tool({
  description:
    "Fetch a web page and return its plain-text content (HTML stripped). Use after webSearch to read a specific result in detail.",
  inputSchema: z.object({
    url: z.string().url().describe("URL to fetch."),
  }),
  execute: async ({ url }) =>
    safe(async () => {
      console.log(url);
      const res = await fetch(url, {
        headers: {
          "User-Agent": YAHOO_HEADERS["User-Agent"],
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        // Abort oversize responses so a malicious URL can't stall the tool.
        signal: AbortSignal.timeout(15_000_000),
      });
      if (!res.ok) throw new Error(`${url} returned ${res.status}.`);
      const contentType = res.headers.get("content-type") ?? "";
      const full = await res.arrayBuffer();
      const sliced =
        full.byteLength > MAX_FETCH_BYTES
          ? full.slice(0, MAX_FETCH_BYTES)
          : full;
      const buffer = new Uint8Array(sliced);
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      let text = raw;
      if (contentType.includes("text/html") || /<html/i.test(raw)) {
        text = raw
          // Drop script/style content entirely so we don't bloat the output.
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/[ \t]+/g, " ")
          .replace(/\n\s*\n\s*\n+/g, "\n\n")
          .trim();
      }
      const truncated = text.length > MAX_TEXT_LENGTH;
      return {
        url,
        contentType,
        length: text.length,
        truncated,
        content: truncated ? text.slice(0, MAX_TEXT_LENGTH) : text,
      };
    }),
});

export const ORBIT_TOOLS = {
  weather: weatherTool,
  stockQuote: stockQuoteTool,
  stockHistory: stockHistoryTool,
  newsSearch: newsSearchTool,
  webSearch: webSearchTool,
  webFetch: webFetchTool,
  currency: currencyTool,
  wikipedia: wikipediaTool,
  datetime: datetimeTool,
  calculator: calculatorTool,
};

export type OrbitToolName = keyof typeof ORBIT_TOOLS;
