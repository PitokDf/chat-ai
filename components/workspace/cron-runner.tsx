"use client";

import { useEffect, useRef } from "react";
import { CronExpressionParser } from "cron-parser";
import { useCron } from "@/lib/store/cron";
import { useSettings, selectCurrentKey } from "@/lib/store/settings";
import { useSkills } from "@/lib/store/skills";
import { useMemory } from "@/lib/store/memory";

export function CronRunner() {
  const jobs = useCron((s) => s.jobs);
  const setJobResult = useCron((s) => s.setJobResult);
  const runningRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => {
      const settings = useSettings.getState();
      const apiKey = selectCurrentKey(settings);
      if (!apiKey) {
        scheduleNext(60_000);
        return;
      }

      const skills = useSkills.getState().skills;
      const memories = useMemory.getState().memories;
      const now = Date.now();

      let minDelay = 60_000;

      for (const job of useCron.getState().jobs) {
        if (!job.enabled || !job.prompt.trim()) continue;
        if (runningRef.current.has(job.id)) continue;

        try {
          const parsed = CronExpressionParser.parse(job.cronExpression, {
            currentDate: new Date(now),
          });
          const nextDate = parsed.next().toDate();
          const nextTime = nextDate.getTime();
          const delay = nextTime - now;

          if (delay <= 0) {
            // Time to run
            if (delay > -5000) {
              runningRef.current.add(job.id);
              fetch("/api/channels/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: job.prompt,
                  providerId: job.providerId,
                  modelId: job.modelId,
                  apiKey,
                  skills: skills ?? [],
                  memories: memories ?? [],
                }),
              })
                .then((res) => (res.ok ? res.json() : null))
                .then((data: { text?: string } | null) => {
                  if (data?.text) {
                    setJobResult(job.id, data.text);
                  }
                })
                .catch(() => {})
                .finally(() => {
                  runningRef.current.delete(job.id);
                });
            }
            minDelay = Math.min(minDelay, 5000);
          } else {
            minDelay = Math.min(minDelay, delay);
          }
        } catch {
          // invalid cron expression, skip
        }
      }

      scheduleNext(Math.min(minDelay, 600_000));
    };

    const scheduleNext = (delayMs: number) => {
      const clamped = Math.max(1000, Math.min(delayMs, 600_000));
      timerRef.current = setTimeout(tick, clamped);
    };

    tick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobs, setJobResult]);

  return null;
}
