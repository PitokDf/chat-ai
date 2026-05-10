"use client";

import {
  BookOpen,
  Calculator,
  Clock,
  CircleDollarSign,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

import { hasError, type ToolCardProps } from "./types";

export function CurrencyCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as
    | {
        from: string;
        to: string;
        amount: number;
        rate: number;
        converted: number;
        date: string;
      }
    | undefined;
  if (!data) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <CircleDollarSign className="h-5 w-5 text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-foreground">
          {data.amount.toLocaleString()} {data.from} ={" "}
          {data.converted.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })}{" "}
          {data.to}
        </p>
        <p className="text-[10px] text-muted-foreground">
          1 {data.from} ={" "}
          {data.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
          {data.to} · rate date {data.date}
        </p>
      </div>
    </div>
  );
}

export function WikipediaCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as
    | {
        title: string;
        description: string | null;
        extract: string;
        url: string | null;
        thumbnail: string | null;
      }
    | undefined;
  if (!data) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex gap-3 px-3 py-2.5">
        <div className="shrink-0">
          {data.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.thumbnail}
              alt={data.title}
              className="h-14 w-14 rounded object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded bg-muted">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            Wikipedia
          </div>
          <p className="mt-0.5 text-[13px] font-semibold text-foreground">
            {data.title}
          </p>
          {data.description ? (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {data.description}
            </p>
          ) : null}
          <p className="mt-1 line-clamp-3 text-[11px] text-foreground/80">
            {data.extract}
          </p>
          {data.url ? (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Read more <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DateTimeCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as
    | { timezone: string; iso: string; formatted: string; epoch: number }
    | undefined;
  if (!data) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <Clock className="h-5 w-5 text-sky-400" />
      <div>
        <p className="text-[12px] font-medium text-foreground">
          {data.formatted}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {data.timezone} · {data.iso}
        </p>
      </div>
    </div>
  );
}

export function CalculatorCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as
    | { expression: string; result: number }
    | undefined;
  if (!data) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <Calculator className="h-5 w-5 text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] text-muted-foreground">
          {data.expression}
        </p>
        <p className="text-[14px] font-semibold text-foreground">
          ={" "}
          {data.result.toLocaleString(undefined, { maximumFractionDigits: 6 })}
        </p>
      </div>
    </div>
  );
}
