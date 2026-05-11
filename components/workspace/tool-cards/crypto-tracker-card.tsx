import { Bitcoin, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatToolCall } from "@/lib/store/chat";

export function CryptoTrackerCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as any;
  if (!data.cryptos) return null;

  return (
    <Card className="max-w-sm py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <Bitcoin className="h-4 w-4 text-orange-500" />
          <CardTitle className="text-sm font-semibold">Crypto Market</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="space-y-2">
          {data.cryptos.map((coin: any, idx: number) => {
            const isUp = coin.change24h >= 0;
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-md bg-muted/30 p-2"
              >
                <div className="flex items-center gap-2">
                  {coin.image && (
                    <img
                      src={coin.image}
                      alt={coin.symbol}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold">{coin.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate w-16">
                      {coin.name}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono font-medium">
                    ${coin.price?.toLocaleString()}
                  </span>
                  <span
                    className={`text-xs flex items-center font-semibold ${isUp ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {isUp ? (
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(coin.change24h)?.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
