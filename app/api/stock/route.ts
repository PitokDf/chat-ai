import { NextRequest, NextResponse } from "next/server";

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://finance.yahoo.com/",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "1mo";
  const interval = searchParams.get("interval") || "1d";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    let data = null;
    const variants = [symbol, `${symbol}.JK`, `${symbol}.ID`];

    for (const v of variants) {
      try {
        const res = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${v.toUpperCase()}?range=${range}&interval=${interval}`,
          { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(10000) },
        );
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {}
    }

    if (!data) {
      return NextResponse.json(
        { error: "Failed to fetch stock data" },
        { status: 404 },
      );
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quotes = result.indicators.quote[0];

    const chartData = result.timestamp
      .map((t: number, i: number) => ({
        date: new Date(t * 1000).toISOString(),
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i],
      }))
      .filter(
        (p: { close: number | null }) => p.close !== null && p.close !== undefined,
      );

    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    return NextResponse.json({
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      price: currentPrice,
      change,
      changePercent,
      previousClose,
      currency: meta.currency,
      exchange: meta.exchangeName,
      chartData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch stock data",
      },
      { status: 500 },
    );
  }
}
