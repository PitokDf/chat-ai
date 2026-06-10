"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Search,
  Loader2,
  RefreshCw,
  Settings2,
  ChevronLeft,
} from "lucide-react";
import { StockChart } from "./stock-chart";
import {
  useChart,
  type ChartType,
  type IndicatorType,
  type ChartTimeframe,
} from "@/lib/store/chart";
import { Button } from "@/components/ui/button";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
}

interface ChartData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const POPULAR_STOCKS = [
  { symbol: "BBCA.JK", name: "Bank BCA" },
  { symbol: "BBRI.JK", name: "Bank BRI" },
  { symbol: "BMRI.JK", name: "Bank Mandiri" },
  { symbol: "TLKM.JK", name: "Telkom" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "GOOGL", name: "Google" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "TSLA", name: "Tesla" },
];

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "candlestick", label: "Candle" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "bar", label: "Bar" },
];

const TIMEFRAMES: { value: ChartTimeframe; label: string }[] = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "YTD", label: "YTD" },
];

const INDICATORS: { value: IndicatorType; label: string }[] = [
  { value: "sma20", label: "SMA 20" },
  { value: "sma50", label: "SMA 50" },
  { value: "sma200", label: "SMA 200" },
  { value: "ema12", label: "EMA 12" },
  { value: "ema26", label: "EMA 26" },
  { value: "bollinger", label: "BB" },
  { value: "vwap", label: "VWAP" },
  { value: "volume", label: "Vol" },
];

export function StockChartPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [allData, setAllData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const {
    symbol: currentSymbol,
    timeframe,
    chartType,
    indicators,
    trendlines,
    horizontalLines,
    setSymbol,
    setTimeframe,
    setChartType,
    toggleIndicator,
  } = useChart();

  useEffect(() => {
    if (!currentSymbol) return;

    let cancelled = false;
    const rangeMap: Record<ChartTimeframe, string> = {
      "1D": "5d",
      "1W": "1mo",
      "1M": "6mo",
      "3M": "1y",
      "6M": "2y",
      "1Y": "5y",
      YTD: "1y",
    };
    const intervalMap: Record<ChartTimeframe, string> = {
      "1D": "5m",
      "1W": "15m",
      "1M": "1d",
      "3M": "1d",
      "6M": "1wk",
      "1Y": "1wk",
      YTD: "1d",
    };

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const range = rangeMap[timeframe];
        const interval = intervalMap[timeframe];

        const res = await fetch(
          `/api/stock?symbol=${encodeURIComponent(currentSymbol)}&range=${range}&interval=${interval}`,
        );

        if (!res.ok) throw new Error("Failed to fetch stock data");

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (!cancelled) {
          setStockData({
            symbol: data.symbol || currentSymbol,
            name: data.name || currentSymbol,
            price: data.price || 0,
            change: data.change || 0,
            changePercent: data.changePercent || 0,
            currency: data.currency || "USD",
          });
          setAllData(data.chartData || []);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [currentSymbol, timeframe]);

  useEffect(() => {
    if (!autoRefresh || !currentSymbol) return;

    const rangeMap: Record<ChartTimeframe, string> = {
      "1D": "5d",
      "1W": "1mo",
      "1M": "6mo",
      "3M": "1y",
      "6M": "2y",
      "1Y": "5y",
      YTD: "1y",
    };
    const intervalMap: Record<ChartTimeframe, string> = {
      "1D": "5m",
      "1W": "15m",
      "1M": "1d",
      "3M": "1d",
      "6M": "1wk",
      "1Y": "1wk",
      YTD: "1d",
    };

    const refreshInterval = timeframe === "1D" ? 15000 : timeframe === "1W" ? 30000 : 60000;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/stock?symbol=${encodeURIComponent(currentSymbol)}&range=${rangeMap[timeframe]}&interval=${intervalMap[timeframe]}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.error) return;

        setStockData({
          symbol: data.symbol || currentSymbol,
          name: data.name || currentSymbol,
          price: data.price || 0,
          change: data.change || 0,
          changePercent: data.changePercent || 0,
          currency: data.currency || "USD",
        });
        setAllData(data.chartData || []);
        setLastUpdated(new Date());
      } catch {}
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, currentSymbol, timeframe]);

  const chartData = useMemo(() => {
    if (allData.length === 0) return [];

    const now = new Date();
    let filterDate = new Date();

    switch (timeframe) {
      case "1D":
        filterDate.setDate(now.getDate() - 1);
        break;
      case "1W":
        filterDate.setDate(now.getDate() - 7);
        break;
      case "1M":
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        filterDate.setMonth(now.getMonth() - 6);
        break;
      case "1Y":
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      case "YTD":
        filterDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const filtered = allData.filter((d) => new Date(d.date) >= filterDate);
    return filtered.length > 20 ? filtered : allData;
  }, [allData, timeframe]);

  const handleLoadMore = useCallback(async () => {
    if (!currentSymbol || allData.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/stock?symbol=${encodeURIComponent(currentSymbol)}&range=2y&interval=1d`,
      );
      if (!res.ok) throw new Error("Failed to fetch more data");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newData = data.chartData || [];
      setAllData((prev) => {
        const combined = [...prev, ...newData];
        const unique = combined.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.date === item.date),
        );
        return unique.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more data");
    } finally {
      setIsLoading(false);
    }
  }, [currentSymbol, allData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const sym = searchQuery.trim().toUpperCase();
      setSymbol(sym);
      setSearchQuery("");
    }
  };

  const handleStockClick = (sym: string) => {
    setSymbol(sym);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g., BBCA.JK, AAPL)..."
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:border-ring focus:outline-none"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="h-7 px-2">
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
        </form>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowSettings(!showSettings)}
          className="h-7 w-7 p-0"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        {currentSymbol && (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTimeframe(timeframe)}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`rounded px-2 py-1 text-[10px] transition ${
                autoRefresh
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {autoRefresh ? "LIVE" : "AUTO"}
            </button>
          </>
        )}
      </div>

      {showSettings && (
        <div className="border-b border-border bg-muted/20 p-3 space-y-3">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Chart Type
            </label>
            <div className="mt-1 flex gap-1">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setChartType(ct.value)}
                  className={`rounded px-2 py-1 text-[10px] transition ${
                    chartType === ct.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Indicators
            </label>
            <div className="mt-1 flex flex-wrap gap-1">
              {INDICATORS.map((ind) => (
                <button
                  key={ind.value}
                  type="button"
                  onClick={() => toggleIndicator(ind.value)}
                  className={`rounded px-2 py-1 text-[10px] transition ${
                    indicators.includes(ind.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {ind.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        {POPULAR_STOCKS.map((stock) => (
          <button
            key={stock.symbol}
            type="button"
            onClick={() => handleStockClick(stock.symbol)}
            className={`rounded-full px-2.5 py-1 text-[10px] transition ${
              currentSymbol === stock.symbol
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {stock.symbol.replace(".JK", "")}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isLoading && allData.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => setTimeframe(timeframe)}>
              Retry
            </Button>
          </div>
        ) : !currentSymbol ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Search for a stock symbol
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Try BBCA.JK, AAPL, or click a popular stock above
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col">
            {stockData && (
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div>
                  <h3 className="text-sm font-semibold">{stockData.symbol}</h3>
                  <p className="text-[10px] text-muted-foreground">{stockData.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">
                    {stockData.currency} {stockData.price.toLocaleString()}
                  </p>
                  <p
                    className={`flex items-center gap-1 font-mono text-xs ${
                      stockData.change >= 0 ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {stockData.change >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {stockData.change >= 0 ? "+" : ""}
                    {stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
              <div className="flex gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    type="button"
                    onClick={() => setTimeframe(tf.value)}
                    className={`rounded px-2 py-0.5 text-[10px] transition ${
                      timeframe === tf.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground">
                    Updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {chartData.length} pts
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="h-6 px-2 text-[10px]"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <ChevronLeft className="h-3 w-3" />
                      Load More
                    </>
                  )}
                </Button>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="flex-1 min-h-0">
                <StockChart
                  data={chartData}
                  symbol={currentSymbol}
                  indicators={indicators}
                  trendlines={trendlines}
                  horizontalLines={horizontalLines}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">No chart data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
