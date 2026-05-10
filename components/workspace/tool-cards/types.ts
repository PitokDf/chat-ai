import type { ChatToolCall } from "@/lib/store/chat";

export type ToolCardProps = {
  call: ChatToolCall;
};

export const hasError = (output: unknown): output is { error: string } =>
  !!output && typeof output === "object" && "error" in output;
