import { BarChart3, TrendingUp, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatToolCall } from "@/lib/store/chat";

interface ChartOutput {
  action: string;
  message: string;
}

export function ChartControlCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as ChartOutput;

  return (
    <Card className="max-w-sm py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Chart Control</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="rounded-md bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">{data.message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartDrawCard({ call }: { call: ChatToolCall }) {
  if (call.status !== "done" || !call.output) return null;

  const data = call.output as ChartOutput;

  return (
    <Card className="max-w-sm py-0 rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          {data.action === "clearDrawings" ? (
            <Trash2 className="h-4 w-4 text-destructive" />
          ) : (
            <TrendingUp className="h-4 w-4 text-primary" />
          )}
          <CardTitle className="text-sm font-semibold">
            {data.action === "addTrendline"
              ? "Trendline Added"
              : data.action === "addHorizontalLine"
                ? "Line Added"
                : "Drawings Cleared"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="rounded-md bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">{data.message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
