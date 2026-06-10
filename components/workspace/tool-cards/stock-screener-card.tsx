import { Filter, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatToolCall } from "@/lib/store/chat";

export function StockScreenerCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as any;
  if (!data.stocks) return null;

  const criteriaLabels: Record<string, string> = {
    large_cap: "Large Cap",
    mid_cap: "Mid Cap",
    small_cap: "Small Cap",
    high_dividend: "High Dividend",
    growth: "Growth",
    value: "Value",
    momentum: "Momentum",
  };

  return (
    <Card className="max-w-md py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Stock Screener: {criteriaLabels[data.criteria] || data.criteria}
          </CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">{data.count} stocks</span>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="space-y-2">
          {data.stocks.map((stock: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-md bg-muted/30 p-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-bold">{stock.symbol}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {stock.name}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono font-medium">
                  ${stock.price?.toFixed(2)}
                </span>
                <span
                  className={`text-xs flex items-center font-semibold ${
                    stock.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {stock.changePercent >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {stock.changePercent?.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
