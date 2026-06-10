"use client";

import { Bot, User } from "lucide-react";
import { useAgents } from "@/lib/store/agents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AgentPicker() {
  const agents = useAgents((s) => s.agents);
  const activeId = useAgents((s) => s.activeAgentId);
  const setActive = useAgents((s) => s.setActiveAgent);

  if (agents.length === 0) return null;

  const activeAgent = agents.find((a) => a.id === activeId);

  return (
    <Select
      value={activeId ?? "__default__"}
      onValueChange={(v) => setActive(v === "__default__" ? null : v)}
    >
      <SelectTrigger className="h-8 w-8 sm:w-auto min-w-[32px] sm:min-w-[140px]">
        <SelectValue
          className="hidden sm:inline"
          placeholder={activeAgent?.name ?? "Default"}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__default__">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Default
          </span>
        </SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            <span className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              <span className="truncate">{agent.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
