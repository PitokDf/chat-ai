import { Calculator, ShieldAlert, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ChatToolCall } from "@/lib/store/chat";

export function RiskCalculatorCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as any;
  if (!data.capital) return null;

  return (
    <Card className="max-w-sm py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Risk & Position Size
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col bg-muted/30 p-2 rounded-md">
            <span className="text-xs text-muted-foreground">Entry Price</span>
            <span className="font-mono font-medium">
              {data.entryPrice?.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col bg-rose-500/10 p-2 rounded-md">
            <span className="text-xs text-rose-500 flex items-center">
              <ShieldAlert className="w-3 h-3 mr-1" />
              Stop Loss
            </span>
            <span className="font-mono font-medium text-rose-500">
              {data.stopLossPrice?.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shares/Lots to Buy</span>
            <span className="font-mono font-bold">
              {data.sharesToBuy?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Invested</span>
            <span className="font-mono">
              {data.totalInvestment?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Max Risk ({data.riskPercentage}%)
            </span>
            <span className="font-mono text-rose-500">
              -{data.actualLoss?.toLocaleString()}
            </span>
          </div>

          {data.targetPrice && (
            <>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Target className="w-3 h-3 mr-1 text-emerald-500" /> Take
                  Profit
                </span>
                <span className="font-mono text-emerald-500">
                  {data.targetPrice?.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Profit</span>
                <span className="font-mono text-emerald-500">
                  +{data.profitAmount?.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk/Reward Ratio</span>
                <span className="font-mono font-bold">
                  1 : {data.rrr?.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
