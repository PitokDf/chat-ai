import { BadgeDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatToolCall } from "@/lib/store/chat";

export function DividendHistoryCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as any;
  if (!data.dividend) return null;

  const div = data.dividend;

  return (
    <Card className="max-w-sm py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Dividend: {data.symbol}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="grid grid-cols-2 gap-2">
          {div.yield != null && (
            <div className="rounded-md bg-muted/30 p-2">
              <span className="text-[10px] text-muted-foreground">Yield</span>
              <p className="font-mono font-semibold text-emerald-500">
                {(div.yield * 100).toFixed(2)}%
              </p>
            </div>
          )}
          {div.rate != null && (
            <div className="rounded-md bg-muted/30 p-2">
              <span className="text-[10px] text-muted-foreground">Annual Rate</span>
              <p className="font-mono font-medium">${div.rate?.toFixed(2)}</p>
            </div>
          )}
          {div.payoutRatio != null && (
            <div className="rounded-md bg-muted/30 p-2">
              <span className="text-[10px] text-muted-foreground">Payout Ratio</span>
              <p className="font-mono font-medium">
                {(div.payoutRatio * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {div.fiveYearAvgDividendYield != null && (
            <div className="rounded-md bg-muted/30 p-2">
              <span className="text-[10px] text-muted-foreground">5Y Avg Yield</span>
              <p className="font-mono font-medium">
                {div.fiveYearAvgDividendYield?.toFixed(2)}%
              </p>
            </div>
          )}
        </div>
        {div.exDate && (
          <div className="mt-2 rounded-md bg-muted/20 p-2">
            <span className="text-[10px] text-muted-foreground">Ex-Dividend Date</span>
            <p className="font-medium">{div.exDate}</p>
          </div>
        )}
        {data.note && (
          <p className="mt-2 text-[10px] text-muted-foreground italic">{data.note}</p>
        )}
      </CardContent>
    </Card>
  );
}
