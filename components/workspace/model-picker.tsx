"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, Brain, Loader2, RefreshCw, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { useModels } from "@/lib/store/models";
import { useSettings } from "@/lib/store/settings";

export function ModelPicker() {
  const providerId = useSettings((s) => s.providerId);
  const modelId = useSettings((s) => s.modelId);
  const apiKeys = useSettings((s) => s.apiKeys);
  const setModel = useSettings((s) => s.setModel);

  const entry = useModels((s) => s.byProvider[providerId]);
  const fetchModels = useModels((s) => s.fetchModels);
  const getEntry = useModels((s) => s.getEntry);

  const currentKey = apiKeys[providerId] ?? "";
  const activeEntry = entry ?? getEntry(providerId);
  const models = activeEntry.models;
  const status = activeEntry.status;

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Auto-fetch whenever provider or its key changes.
  useEffect(() => {
    void fetchModels(providerId, currentKey);
  }, [providerId, currentKey, fetchModels]);

  // Keep selected model valid relative to the current provider's list.
  useEffect(() => {
    if (models.length === 0) return;
    if (!models.some((m) => m.id === modelId)) {
      setModel(providerId, models[0].id);
    }
  }, [models, modelId, providerId, setModel]);

  const handleProviderChange = (next: ProviderId) => {
    const cached = useModels.getState().byProvider[next];
    const firstModel =
      cached?.models?.[0]?.id ??
      PROVIDERS.find((p) => p.id === next)?.models?.[0]?.id ??
      "";
    setModel(next, firstModel);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={providerId}
        onValueChange={(value) => handleProviderChange(value as ProviderId)}
      >
        <SelectTrigger className="h-8 w-8 sm:w-auto min-w-[32px] sm:min-w-[180px]">
          <Server className="w-5 h-5" />
          <SelectValue className="hidden sm:inline" />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map((provider) => (
            <SelectItem
              disabled={!apiKeys[provider.id]}
              key={provider.id}
              value={provider.id}
            >
              <span className="flex items-center gap-1.5">
                {provider.name}
                {!apiKeys[provider.id] ? (
                  <span className="text-[10px] text-muted-foreground">
                    · no key
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={modelId}
        onValueChange={(value) => setModel(providerId, value)}
        disabled={models.length === 0}
      >
        <SelectTrigger className="h-8 w-8 sm:w-auto min-w-[32px] sm:min-w-[180px]">
          <Brain className="w-5 h-5" />
          <SelectValue
            className="hidden sm:inline"
            placeholder="Select model"
          />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={() => void fetchModels(providerId, currentKey)}
        disabled={status === "loading"}
        aria-label="Refresh model list"
        title={
          !mounted
            ? "Refresh list"
            : status === "live"
              ? "Live from provider API"
              : status === "fallback"
                ? currentKey
                  ? "Using built-in list (live fetch failed)"
                  : "Using built-in list (add API key for live list)"
                : status === "error"
                  ? `Error: ${activeEntry.error}`
                  : "Refresh list"
        }
      >
        {!mounted || status === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : status === "error" ? (
          <AlertCircle className="h-3 w-3 text-destructive" />
        ) : (
          <RefreshCw
            className={
              status === "fallback" ? "h-3 w-3 text-amber-400" : "h-3 w-3"
            }
          />
        )}
      </Button>
    </div>
  );
}
