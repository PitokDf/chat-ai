"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  ListMusic,
  ExternalLink,
} from "lucide-react";
import { useMusic } from "@/lib/store/music";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function MusicPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    queue,
    playTrack,
    togglePlay,
    next,
    prev,
    setVolume,
    seek,
    removeFromQueue,
    updateTime,
  } = useMusic();

  const [showQueue, setShowQueue] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeRef = useRef(0);

  const stopTimeTracking = useCallback(() => {
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  }, []);

  const startTimeTracking = useCallback(() => {
    stopTimeTracking();
    lastTimeRef.current = currentTime;
    timeIntervalRef.current = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "getCurrentTime",
            args: [],
          }),
          "*",
        );
      }
    }, 500);
  }, [currentTime, stopTimeTracking]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data = JSON.parse(event.data);

        if (data.event === "infoDelivery" && data.info) {
          const t = data.info.currentTime ?? 0;
          const d = data.info.duration ?? 0;
          updateTime(t, d);
        }

        if (data.event === "onStateChange") {
          const state = data.info;
          if (state === 1) {
            startTimeTracking();
          } else if (state === 2 || state === 0) {
            stopTimeTracking();
            if (state === 0) next();
          }
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [next, updateTime, startTimeTracking, stopTimeTracking]);

  useEffect(() => {
    if (isPlaying) {
      startTimeTracking();
    } else {
      stopTimeTracking();
    }
  }, [isPlaying, startTimeTracking, stopTimeTracking]);

  useEffect(() => {
    if (currentTime >= duration && duration > 0 && isPlaying) {
      next();
    }
  }, [currentTime, duration, isPlaying, next]);

  const handlePlayClick = useCallback(() => {
    if (!currentTrack) return;
    setShowPlayer(true);
    togglePlay();
  }, [currentTrack, togglePlay]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = Math.floor(ratio * duration);
    seek(newTime);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "seekTo",
          args: [newTime, true],
        }),
        "*",
      );
    }
  };

  const handlePrev = useCallback(() => {
    if (currentTime > 3) {
      seek(0);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "seekTo",
            args: [0, true],
          }),
          "*",
        );
      }
      return;
    }
    prev();
  }, [currentTime, seek, prev]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  useEffect(() => {
    return () => stopTimeTracking();
  }, [stopTimeTracking]);

  if (!currentTrack && queue.length === 0) return null;

  return (
    <>
      {showPlayer && currentTrack && (
        <div className="fixed bottom-20 right-4 z-50 shadow-2xl rounded-lg overflow-hidden border border-border">
          <iframe
            ref={iframeRef}
            key={currentTrack.videoId}
            src={`https://www.youtube.com/embed/${currentTrack.videoId}?autoplay=1&enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}&controls=1&disablekb=0&fs=0&modestbranding=1&rel=0`}
            width="320"
            height="180"
            style={{ border: "none", display: "block" }}
            allow="autoplay; encrypted-media"
            title="YouTube Player"
          />
          <button
            type="button"
            onClick={() => setShowPlayer(false)}
            className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white hover:bg-black/70 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="border-t border-border bg-card px-3 py-2">
        <div className="flex items-center gap-3">
          {currentTrack && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <img
                src={currentTrack.thumbnail}
                alt=""
                className="h-10 w-14 rounded object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {currentTrack.title}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {currentTrack.author}
                </p>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${currentTrack.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handlePlayClick}
                className="rounded-full bg-foreground p-1.5 text-background transition hover:opacity-80"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={next}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <div
                className="h-1 w-32 cursor-pointer rounded-full bg-muted"
                onClick={handleSeek}
              >
                <div
                  className="h-1 rounded-full bg-foreground transition-all"
                  style={{
                    width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
              </div>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded p-1 text-muted-foreground transition hover:text-foreground"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v === 0) setIsMuted(true);
                else if (isMuted) setIsMuted(false);
                setVolume(v);
              }}
              className="h-1 w-16 accent-foreground"
            />
            {queue.length > 0 && (
              <button
                type="button"
                onClick={() => setShowQueue((s) => !s)}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <ListMusic className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {showQueue && queue.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border bg-muted/30">
            {queue.map((track, i) => (
              <div
                key={`${track.videoId}-${i}`}
                className={`flex items-center gap-2 px-2 py-1.5 transition hover:bg-muted/50 ${
                  currentTrack?.videoId === track.videoId ? "bg-muted/50" : ""
                }`}
              >
                <img
                  src={track.thumbnail}
                  alt=""
                  className="h-6 w-10 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => playTrack(track)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[11px] font-medium">
                    {track.title}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {track.author}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => removeFromQueue(i)}
                  className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
