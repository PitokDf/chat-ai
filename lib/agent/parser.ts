/**
 * Streaming parser for orbitArtifact / orbitAction blocks.
 *
 * The model emits free text mixed with XML-ish blocks like:
 *
 * Building a todo app...
 * <orbitArtifact id="todo" title="Todo app">
 * <orbitAction type="file" filePath="package.json">
 * ...file body...
 * </orbitAction>
 * <orbitAction type="shell">npm install</orbitAction>
 * <orbitAction type="start">npm run dev</orbitAction>
 * </orbitArtifact>
 *
 * We consume chunks as they stream in and emit events:
 *  - text: plain prose outside of <orbitArtifact>
 *  - artifact-open / artifact-close
 *  - action-open / action-delta / action-close
 */

export type ActionType = "file" | "shell" | "start" | "preview";

export type ParsedAction = {
  id: number;
  type: ActionType;
  filePath?: string;
  content: string;
};

export type ParsedArtifact = {
  id: string;
  title: string;
  actions: ParsedAction[];
};

export type ParserEvent =
  | { kind: "text"; text: string }
  | { kind: "artifact-open"; id: string; title: string }
  | { kind: "artifact-close" }
  | { kind: "action-open"; action: ParsedAction }
  | { kind: "action-delta"; actionId: number; chunk: string }
  | { kind: "action-close"; actionId: number };

type State =
  | { mode: "text" }
  | { mode: "artifact" }
  | {
      mode: "action";
      action: ParsedAction;
    };

const ARTIFACT_OPEN = /<orbitArtifact\b([^>]*)>/;
const ARTIFACT_CLOSE = "</orbitArtifact>";
const ACTION_OPEN = /<orbitAction\b([^>]*)>/;
const ACTION_CLOSE = "</orbitAction>";

const parseAttrs = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
};

/**
 * Return the index of the trailing fragment that *might* be the start of a
 * "<orbitArtifact" opening tag we haven't fully received yet. If nothing in
 * the buffer looks like it could be a partial match, return -1 so the caller
 * can flush the entire buffer.
 */
const ARTIFACT_PREFIX = "<orbitArtifact";
const findArtifactTailStart = (buffer: string): number => {
  const full = buffer.lastIndexOf(ARTIFACT_PREFIX);
  if (full !== -1) return full;
  // Look for any trailing prefix of "<orbitArtifact" that could grow into one
  // once more data arrives. Start with the longest possible prefix.
  const maxCheck = Math.min(buffer.length, ARTIFACT_PREFIX.length - 1);
  for (let len = maxCheck; len > 0; len--) {
    const slice = buffer.slice(buffer.length - len);
    if (ARTIFACT_PREFIX.startsWith(slice)) {
      return buffer.length - len;
    }
  }
  return -1;
};

export class ArtifactStreamParser {
  private buffer = "";
  private state: State = { mode: "text" };
  private nextActionId = 0;

  /** Feed a chunk of model output and receive any events it unlocks. */
  push(chunk: string): ParserEvent[] {
    this.buffer += chunk;
    const events: ParserEvent[] = [];

    // Loop because a single chunk may complete several blocks.
    // We stop once we can't make more progress without more data.
    // Each branch either emits events and shrinks the buffer, or bails out.
    for (;;) {
      if (this.state.mode === "text") {
        const openMatch = ARTIFACT_OPEN.exec(this.buffer);
        if (!openMatch) {
          // Hold only the trailing fragment that *could* be the start of a
          // streaming "<orbitArtifact ...>" tag. Earlier characters are safe
          // to flush as text. Without this, the full opening tag (often well
          // over 60 chars) can get leaked into the message body.
          const tailStart = findArtifactTailStart(this.buffer);
          if (tailStart > 0) {
            events.push({
              kind: "text",
              text: this.buffer.slice(0, tailStart),
            });
            this.buffer = this.buffer.slice(tailStart);
          } else if (tailStart === -1) {
            if (this.buffer) events.push({ kind: "text", text: this.buffer });
            this.buffer = "";
          }
          break;
        }

        if (openMatch.index > 0) {
          const text = this.buffer.slice(0, openMatch.index);
          if (text) events.push({ kind: "text", text });
        }
        const attrs = parseAttrs(openMatch[1]);
        events.push({
          kind: "artifact-open",
          id: attrs.id ?? "artifact",
          title: attrs.title ?? "Artifact",
        });
        this.buffer = this.buffer.slice(openMatch.index + openMatch[0].length);
        this.state = { mode: "artifact" };
        continue;
      }

      if (this.state.mode === "artifact") {
        const closeIdx = this.buffer.indexOf(ARTIFACT_CLOSE);
        const actionMatch = ACTION_OPEN.exec(this.buffer);

        // Prefer whichever happens first in the buffer.
        if (closeIdx !== -1 && (!actionMatch || closeIdx < actionMatch.index)) {
          this.buffer = this.buffer.slice(closeIdx + ARTIFACT_CLOSE.length);
          events.push({ kind: "artifact-close" });
          this.state = { mode: "text" };
          continue;
        }

        if (actionMatch) {
          const attrs = parseAttrs(actionMatch[1]);
          const type = (attrs.type as ActionType) || "shell";
          const action: ParsedAction = {
            id: this.nextActionId++,
            type,
            filePath: attrs.filePath,
            content: "",
          };
          this.buffer = this.buffer.slice(
            actionMatch.index + actionMatch[0].length,
          );
          events.push({ kind: "action-open", action });
          this.state = { mode: "action", action };
          continue;
        }

        // Neither action nor close yet, wait for more data.
        break;
      }

      // mode === "action"
      const { action } = this.state;
      const closeIdx = this.buffer.indexOf(ACTION_CLOSE);
      if (closeIdx === -1) {
        // Emit as much body as we can while keeping a safety tail so we
        // don't split a literal "</orbitAction>" across events.
        const safeUpTo = this.buffer.length - ACTION_CLOSE.length;
        if (safeUpTo > 0) {
          const chunkStr = this.buffer.slice(0, safeUpTo);
          action.content += chunkStr;
          events.push({
            kind: "action-delta",
            actionId: action.id,
            chunk: chunkStr,
          });
          this.buffer = this.buffer.slice(safeUpTo);
        }
        break;
      }

      const tail = this.buffer.slice(0, closeIdx);
      if (tail) {
        action.content += tail;
        events.push({
          kind: "action-delta",
          actionId: action.id,
          chunk: tail,
        });
      }
      events.push({ kind: "action-close", actionId: action.id });
      this.buffer = this.buffer.slice(closeIdx + ACTION_CLOSE.length);
      this.state = { mode: "artifact" };
    }

    return events;
  }

  /** Flush any remaining text once the stream is complete. */
  finish(): ParserEvent[] {
    const events: ParserEvent[] = [];
    if (this.state.mode === "text" && this.buffer.length > 0) {
      events.push({ kind: "text", text: this.buffer });
      this.buffer = "";
    }
    return events;
  }
}

/** Strip leading/trailing newlines typically introduced by XML formatting. */
export const normalizeActionContent = (content: string) =>
  content.replace(/^\r?\n/, "").replace(/\r?\n\s*$/, "");
