import { Briefcase, Activity, CheckCircle2 } from "lucide-react";
import type { ToolCardProps } from "./types";
import { hasError } from "./types";

export function PortfolioManagerCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;

  const args = call.args as any;
  const data = call.output as any;
  if (!data?.portfolio) return null;

  const p = data.portfolio;
  const action = data.action;
  
  // Calculate total value
  let holdingsValue = 0;
  Object.values(p.holdings || {}).forEach((h: any) => {
    holdingsValue += h.quantity * h.averagePrice;
  });
  const totalValue = p.balance + holdingsValue;
  
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm w-full max-w-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-3 py-2 text-xs font-medium">
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
          Virtual Portfolio
        </div>
        {(action === "buy" || action === "sell") && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            <CheckCircle2 className="h-3 w-3" />
            {action.toUpperCase()}: {args.quantity} {args.symbol}
          </div>
        )}
      </div>
      
      <div className="flex flex-col gap-3 p-3 text-xs w-full">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/30 p-2 rounded-md">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Value</div>
            <div className="text-lg font-semibold tracking-tight text-foreground">{formatMoney(totalValue)}</div>
          </div>
          <div className="bg-muted/30 p-2 rounded-md">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Cash Balance</div>
            <div className="text-base font-medium tracking-tight text-muted-foreground">{formatMoney(p.balance)}</div>
          </div>
        </div>

        {Object.keys(p.holdings || {}).length > 0 ? (
          <div className="mt-1">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Current Holdings
            </div>
            <div className="space-y-2">
              {Object.entries(p.holdings).map(([sym, h]: [string, any]) => (
                <div key={sym} className="flex justify-between items-center bg-muted/20 p-2 rounded border border-border/50">
                  <div>
                    <div className="font-bold text-foreground">{sym}</div>
                    <div className="text-[10px] text-muted-foreground">{h.quantity} shares</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-foreground">{formatMoney(h.quantity * h.averagePrice)}</div>
                    <div className="text-[10px] text-muted-foreground">Avg: {formatMoney(h.averagePrice)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-[11px] border border-dashed rounded-md border-border">
            Portfolio is empty. Suggest buying some stocks!
          </div>
        )}
      </div>
    </div>
  );
}
