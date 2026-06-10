import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatToolCall } from "@/lib/store/chat";

export function EarningsCalendarCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as any;

  return (
    <Card className="max-w-md py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Earnings: {data.symbol}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        {data.nextEarningsDate && (
          <div className="mb-3 rounded-md bg-muted/30 p-2">
            <span className="text-xs text-muted-foreground">Next Earnings</span>
            <p className="font-medium">
              {new Date(data.nextEarningsDate).toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        )}

        {data.earningsEstimate?.average && (
          <div className="mb-3 rounded-md bg-muted/30 p-2">
            <span className="text-xs text-muted-foreground">EPS Estimate</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">
                ${data.earningsEstimate.average?.toFixed(2)}
              </span>
              {data.earningsEstimate.low && data.earningsEstimate.high && (
                <span className="text-xs text-muted-foreground">
                  (${data.earningsEstimate.low?.toFixed(2)} - ${data.earningsEstimate.high?.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        )}

        {data.earningsHistory?.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Recent Earnings History</span>
            <div className="space-y-1.5">
              {data.earningsHistory.slice(0, 4).map((earning: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md bg-muted/20 p-1.5"
                >
                  <span className="text-xs">{earning.quarter}</span>
                  <div className="flex items-center gap-2">
                    {earning.epsActual != null && (
                      <span className="font-mono text-xs">
                        ${earning.epsActual?.toFixed(2)}
                      </span>
                    )}
                    {earning.surprisePercent != null && (
                      <span
                        className={`text-xs flex items-center font-semibold ${
                          earning.surprisePercent >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {earning.surprisePercent >= 0 ? (
                          <TrendingUp className="h-3 w-3 mr-0.5" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-0.5" />
                        )}
                        {earning.surprisePercent?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.note && (
          <p className="mt-2 text-[10px] text-muted-foreground italic">{data.note}</p>
        )}
      </CardContent>
    </Card>
  );
}
