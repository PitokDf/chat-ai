import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ChatToolCall } from "@/lib/store/chat";

export function MarketMoversCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as any;
  if (!data.movers) return null;

  const isGainers = data.type === "gainers";

  return (
    <Card className="max-w-sm py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Top {isGainers ? "Gainers" : "Losers"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="space-y-2">
          {data.movers.map((mover: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-md bg-muted/30 p-2"
            >
              <div className="flex flex-col">
                <span className="font-bold">{mover.symbol}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                  {mover.name}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono font-medium">
                  ${mover.price?.toFixed(2)}
                </span>
                <span
                  className={`text-xs flex items-center font-semibold ${isGainers ? "text-emerald-500" : "text-rose-500"}`}
                >
                  {isGainers ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {mover.changePercent?.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
