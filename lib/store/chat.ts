"use client";

import { create } from "zustand";

import type { ProviderId } from "@/lib/providers";

export type ChatArtifactAction = {
  id: number;
  type: "file" | "shell" | "start" | "preview";
  filePath?: string;
  content: string;
  status: "streaming" | "running" | "done" | "error";
  /** Optional annotation surfaced in the UI, e.g. "cached" or "skipped". */
  note?: string;
  error?: string;
};

export type ChatArtifact = {
  id: string;
  title: string;
  actions: ChatArtifactAction[];
};

export type ChatToolCallStatus = "pending" | "running" | "done" | "error";

export type ChatToolCall = {
  id: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: ChatToolCallStatus;
  error?: string;
  args?: string;
};

export type ChatAttachment = {
  id: string;
  name: string;
  /** MIME type; we keep a distinction between image and other files for UI. */
  mimeType: string;
  kind: "image" | "file";
  /** data URL, base64 encoded. */
  dataUrl: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  thought?: string;
  artifacts: ChatArtifact[];
  toolCalls: ChatToolCall[];
  attachments?: ChatAttachment[];
  providerId?: ProviderId;
  modelId?: string;
  status: "pending" | "streaming" | "done" | "error";
  createdAt: number;
};

type ChatState = {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updater: (m: ChatMessage) => ChatMessage) => void;
  reset: () => void;
};

export const useChat = create<ChatState>((set) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updater) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? updater(m) : m)),
    })),
  reset: () => set({ messages: [] }),
}));
