"use client";

import { Music, Play, ExternalLink } from "lucide-react";
import { useMusic } from "@/lib/store/music";
import type { ChatToolCall } from "@/lib/store/chat";

type YouTubeResult = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: number;
  views?: number;
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatViews = (views: number) => {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K views`;
  return `${views} views`;
};

export function YouTubeCard({ call }: { call: ChatToolCall }) {
  const { playTrack, addToQueue } = useMusic();
  const output = call.output as { results?: YouTubeResult[]; query?: string } | null;

  if (!output || !output.results) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <Music className="h-3 w-3" />
        <span>YouTube Music</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Music className="h-3.5 w-3.5 text-rose-500" />
        <span className="text-xs font-medium">
          YouTube Results{output.query ? ` for "${output.query}"` : ""}
        </span>
      </div>
      <div className="divide-y divide-border">
        {output.results.map((track) => (
          <div
            key={track.videoId}
            className="flex items-center gap-3 px-3 py-2 transition hover:bg-muted/50"
          >
            <img
              src={track.thumbnail}
              alt=""
              className="h-10 w-16 rounded object-cover"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{track.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {track.author} &middot; {formatDuration(track.duration)}
                {track.views ? ` &middot; ${formatViews(track.views)}` : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => playTrack(track)}
                className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Play now"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => addToQueue(track)}
                className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Add to queue"
              >
                <Music className="h-3.5 w-3.5" />
              </button>
              <a
                href={`https://www.youtube.com/watch?v=${track.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Open on YouTube"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
