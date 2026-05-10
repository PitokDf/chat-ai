"use client";

import { ExternalLink, Newspaper } from "lucide-react";

import { hasError, type ToolCardProps } from "./types";

type NewsOutput = {
  query: string;
  articles: Array<{
    title: string;
    link: string;
    source: string;
    publishedAt: string;
    description: string;
  }>;
};

const formatPublished = (value: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function NewsCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as NewsOutput | undefined;
  if (!data || data.articles.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <Newspaper className="h-3 w-3" />
        <span className="truncate">News · {data.query}</span>
      </div>
      <ul className="divide-y divide-border">
        {data.articles.map((article, index) => (
          <li key={`${article.link}-${index}`} className="px-3 py-2">
            <a
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="group block"
            >
              <p className="text-[12px] font-medium text-foreground group-hover:underline">
                {article.title}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="truncate">{article.source || "Source"}</span>
                {article.publishedAt ? (
                  <>
                    <span>·</span>
                    <span>{formatPublished(article.publishedAt)}</span>
                  </>
                ) : null}
                <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
