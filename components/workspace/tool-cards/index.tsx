"use client";

import { AlertTriangle, Loader2, Wrench } from "lucide-react";

import type { ChatToolCall } from "@/lib/store/chat";

import { NewsCard } from "./news-card";
import { StockHistoryCard } from "./stock-history-card";
import { StockQuoteCard } from "./stock-quote-card";
import { StockTechnicalCard } from "./stock-technical-card";
import { WeatherCard } from "./weather-card";
import { MarketMoversCard } from "./market-movers-card";
import { CryptoTrackerCard } from "./crypto-tracker-card";
import { RiskCalculatorCard } from "./risk-calculator-card";
import { GlobalMarketsCard } from "./global-markets-card";
import { PortfolioManagerCard } from "./portfolio-manager-card";
import {
  CalculatorCard,
  CurrencyCard,
  DateTimeCard,
  WikipediaCard,
} from "./generic-cards";
import { hasError } from "./types";
import { YouTubeCard } from "./youtube-card";

const TOOL_LABEL: Record<string, string> = {
  weather: "Weather",
  stockQuote: "Stock quote",
  stockHistory: "Stock history",
  stockTechnicalAnalysis: "Technical analysis",
  marketMovers: "Market movers",
  cryptoTracker: "Crypto tracker",
  riskCalculator: "Risk calculator",
  globalMarkets: "Global markets",
  portfolioManager: "Virtual portfolio",
  fundamentalAnalysis: "Fundamental analysis",
  financialSentiment: "Market sentiment",
  newsSearch: "News",
  webSearch: "Web search",
  webFetch: "Web fetch",
  readSkill: "Skill reader",
  saveMemory: "Memory",
  currency: "Currency",
  wikipedia: "Wikipedia",
  datetime: "Date & time",
  calculator: "Calculator",
  youtubeMusic: "YouTube Music",
};

const renderCardBody = (call: ChatToolCall) => {
  switch (call.toolName) {
    case "weather":
      return <WeatherCard call={call} />;
    case "stockQuote":
      return <StockQuoteCard call={call} />;
    case "stockHistory":
      return <StockHistoryCard call={call} />;
    case "stockTechnicalAnalysis":
      return <StockTechnicalCard call={call} />;
    case "marketMovers":
      return <MarketMoversCard call={call} />;
    case "cryptoTracker":
      return <CryptoTrackerCard call={call} />;
    case "riskCalculator":
      return <RiskCalculatorCard call={call} />;
    case "globalMarkets":
      return <GlobalMarketsCard call={call} />;
    case "portfolioManager":
      return <PortfolioManagerCard call={call} />;
    case "newsSearch":
      return <NewsCard call={call} />;
    case "currency":
      return <CurrencyCard call={call} />;
    case "wikipedia":
      return <WikipediaCard call={call} />;
    case "datetime":
      return <DateTimeCard call={call} />;
    case "calculator":
      return <CalculatorCard call={call} />;
    case "youtubeMusic":
      return <YouTubeCard call={call} />;
    default:
      return null;
  }
};

export function ToolCallView({ call }: { call: ChatToolCall }) {
  const label = TOOL_LABEL[call.toolName] ?? call.toolName;

  if (call.status === "pending" || call.status === "running") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
        <span>Calling {label}...</span>
      </div>
    );
  }

  if (call.status === "error" || hasError(call.output)) {
    const message =
      call.error ??
      (hasError(call.output) ? call.output.error : "Tool call failed.");
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">{label} failed</p>
          <p className="mt-0.5 text-[10px] text-destructive/80">{message}</p>
        </div>
      </div>
    );
  }

  const body = renderCardBody(call);
  if (body) return body;

  // Fallback for unknown tools: show a generic chip.
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
      <Wrench className="h-3 w-3" />
      <span>{label} · done</span>
    </div>
  );
}
