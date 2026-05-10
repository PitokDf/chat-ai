# Orbit — AI build agent

Orbit is a Bolt.new-style in-browser build agent. You describe what you want,
Orbit writes the code, installs dependencies, and runs a dev server inside a
WebContainer — all in your tab.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- WebContainers (`@webcontainer/api`) for in-browser Node.js
- Vercel AI SDK v6 with provider adapters:
  OpenAI, Anthropic, Google Gemini, Groq, Mistral, NVIDIA NIM, OpenRouter
- Monaco for the editor, Dexie for IndexedDB persistence, Zustand for state
- Tailwind v4 + shadcn radix-nova components

## Features

- Chat with any supported model. Switch providers from the header picker.
- Bring-your-own-key: API keys are stored in localStorage only.
- Agent emits `<orbitArtifact>` blocks that get parsed as they stream and
  executed against the WebContainer (file writes, shell, dev server).
- Live preview of the running dev server in an iframe.
- Editable Monaco editor with file tree. Edits write straight through to the
  sandbox file system.
- Terminal view showing command output and system messages.
- Import any public GitHub repo to start from an existing project.
- Chat history + file snapshots persisted per-project in IndexedDB.

## Getting started

```bash
bun install
bun dev
```

Then open http://localhost:3000, click **API keys**, drop in a key for at
least one provider, and tell Orbit what to build.

## How the agent protocol works

The system prompt instructs the model to reply with a short human message
followed by exactly one `<orbitArtifact>` block containing ordered actions:

```
<orbitArtifact id="todo-app" title="Todo list app">
<orbitAction type="file" filePath="package.json">...</orbitAction>
<orbitAction type="shell">npm install</orbitAction>
<orbitAction type="start">npm run dev</orbitAction>
</orbitArtifact>
```

A streaming parser (`lib/agent/parser.ts`) converts the raw model output
into events that the controller (`lib/agent/controller.ts`) feeds into the
WebContainer via `lib/agent/executor.ts`. Files are written, shell commands
run to completion, and the `start` action spawns a long-running process
whose URL is pulled from the WebContainer `server-ready` event.

## Project structure

```
app/
  api/chat/route.ts       # multi-provider streaming chat endpoint
  api/import/route.ts     # public GitHub repo importer
  layout.tsx, page.tsx    # entry
components/
  ui/                     # shadcn primitives (button, dialog, tabs, ...)
  workspace/              # header, chat, file tree, editor, terminal, preview
lib/
  agent/                  # prompt, parser, executor, controller
  db/                     # Dexie schema
  providers/              # static model registry + server-side factory
  store/                  # zustand stores (chat, workspace, project, settings)
  webcontainer/           # single-instance WebContainer helpers
```

## Cross-origin isolation

WebContainers require `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. Those headers are set in
`next.config.ts` for every path.

## Deploy

Works on any Node.js host, including Vercel. The COOP/COEP headers are
configured via `next.config.ts` so no extra hosting configuration is
required.
