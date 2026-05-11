"use client";

import { TrendingUp, TrendingDown, Activity, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ChatToolCall } from "@/lib/store/chat";

export function StockTechnicalCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as any;

  const getTrendIcon = (trend: string) => {
    if (
      trend.toLowerCase().includes("bullish") ||
      trend.toLowerCase().includes("uptrend")
    ) {
      return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    } else if (
      trend.toLowerCase().includes("bearish") ||
      trend.toLowerCase().includes("downtrend")
    ) {
      return <TrendingDown className="h-4 w-4 text-rose-500" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const trendColor = (trend: string) => {
    if (trend.toLowerCase().includes("bullish")) return "text-emerald-500";
    if (trend.toLowerCase().includes("bearish")) return "text-rose-500";
    return "text-muted-foreground";
  };

  return (
    <Card className="max-w-xs py-0 overflow-hidden rounded-xl border-border bg-card/50  shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            {data.symbol} Tech Analysis
          </CardTitle>
        </div>
        <div className="font-mono text-sm font-bold">
          {data.currentPrice?.toFixed(2)}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="mb-3 space-y-1 rounded-md bg-muted/50 p-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trend</span>
            <div
              className={`flex items-center gap-1 font-medium ${trendColor(data.analysis?.trend || "")}`}
            >
              {getTrendIcon(data.analysis?.trend || "")}
              {data.analysis?.trend?.split(" ")[0]}{" "}
              {/* Shorten to Bullish/Bearish */}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Momentum</span>
            <span className="font-medium">{data.analysis?.momentum}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MACD Signal</span>
            <span
              className={`font-medium ${trendColor(data.analysis?.macdSignal || "")}`}
            >
              {data.analysis?.macdSignal}
            </span>
          </div>
        </div>

        <Separator className="my-2" />

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">RSI (14)</span>
            <span className="font-mono">
              {data.indicators?.rsi14?.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MACD</span>
            <span className="font-mono">
              {data.indicators?.macd?.macdLine?.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">SMA (20)</span>
            <span className="font-mono">
              {data.indicators?.sma20?.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">BB Upper</span>
            <span className="font-mono">
              {data.indicators?.bollingerBands?.upper?.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
