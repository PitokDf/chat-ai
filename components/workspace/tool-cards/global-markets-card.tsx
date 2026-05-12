import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import type { ToolCardProps } from "./types";
import { hasError } from "./types";

export function GlobalMarketsCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;

  const data = call.output as { quotes: any[] };
  if (!data?.quotes?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm w-full max-w-sm overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/40 px-3 py-2 text-xs font-medium">
        <Globe className="h-3.5 w-3.5 text-primary" />
        Global Markets & Commodities
      </div>
      <div className="flex flex-col gap-2 p-3 text-xs w-full overflow-x-auto">
        <table className="w-full text-right">
          <thead className="text-[10px] text-muted-foreground">
            <tr>
              <th className="font-normal text-left pb-2">SYMBOL</th>
              <th className="font-normal pb-2">PRICE</th>
              <th className="font-normal pb-2">CHANGE</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.quotes.map((q: any, i: number) => {
              const up = q.change >= 0;
              const formatPrice = (val: number) => {
                if (val >= 1000) return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (val < 0.1) return val.toFixed(4);
                return val.toFixed(2);
              };
              
              return (
                <tr key={i} className="border-t border-border/30 last:border-0">
                  <td className="py-2 text-left truncate max-w-[100px]">
                    <div className="font-medium text-foreground">{q.symbol}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{q.name}</div>
                  </td>
                  <td className="py-2">{formatPrice(q.price)}</td>
                  <td className="py-2">
                    <div className={`flex items-center justify-end gap-1 ${up ? "text-emerald-500" : "text-rose-500"}`}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>{up ? "+" : ""}{formatPrice(q.change)}</span>
                    </div>
                    <div className={`text-[10px] ${up ? "text-emerald-500/80" : "text-rose-500/80"}`}>
                      {up ? "+" : ""}{q.changePercent?.toFixed(2)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
