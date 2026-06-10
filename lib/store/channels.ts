"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ChannelConfig = {
  id: string;
  name: string;
  type: "telegram" | "discord" | "whatsapp" | "slack";
  enabled: boolean;
  config: Record<string, string>;
};

export type ChannelsState = {
  channels: ChannelConfig[];
  addChannel: (channel: Omit<ChannelConfig, "id">) => void;
  updateChannel: (id: string, data: Partial<Omit<ChannelConfig, "id">>) => void;
  removeChannel: (id: string) => void;
  toggleChannel: (id: string) => void;
};

export const CHANNEL_TYPES = ["telegram", "discord", "whatsapp", "slack"] as const;

export const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  discord: "Discord",
  whatsapp: "WhatsApp",
  slack: "Slack",
};

export const CHANNEL_CONFIG_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string; secret?: boolean }>> = {
  telegram: [
    { key: "botToken", label: "Bot Token", placeholder: "123456:ABC-DEF...", secret: true },
    { key: "chatId", label: "Chat ID (optional)", placeholder: "Leave empty to auto-detect" },
  ],
  discord: [
    { key: "botToken", label: "Bot Token", placeholder: "Your Discord bot token", secret: true },
    { key: "channelId", label: "Channel ID", placeholder: "Discord channel ID" },
  ],
  whatsapp: [
    { key: "phoneNumberId", label: "Phone Number ID", placeholder: "Meta WhatsApp Phone ID" },
    { key: "accessToken", label: "Access Token", placeholder: "Permanent access token", secret: true },
  ],
  slack: [
    { key: "botToken", label: "Bot Token", placeholder: "xoxb-...", secret: true },
    { key: "channelId", label: "Channel ID (optional)", placeholder: "Slack channel ID" },
  ],
};

export const useChannels = create<ChannelsState>()(
  persist(
    (set) => ({
      channels: [],

      addChannel: (channel) =>
        set((state) => ({
          channels: [
            ...state.channels,
            { ...channel, id: `${channel.type}-${Date.now()}` },
          ],
        })),

      updateChannel: (id, data) =>
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === id ? { ...c, ...data } : c,
          ),
        })),

      removeChannel: (id) =>
        set((state) => ({
          channels: state.channels.filter((c) => c.id !== id),
        })),

      toggleChannel: (id) =>
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === id ? { ...c, enabled: !c.enabled } : c,
          ),
        })),
    }),
    {
      name: "orbit-channels",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
