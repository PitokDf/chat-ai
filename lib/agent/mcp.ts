import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type CachedServer = {
  id: string;
  command: string;
  args: string[];
  client: Client;
  transport: StdioClientTransport;
  ready: Promise<void>;
};

declare global {
  var __mcpCache: Record<string, CachedServer>;
}

if (!globalThis.__mcpCache) {
  globalThis.__mcpCache = {};
}

export async function getMcpClients(
  servers: Array<{ id: string; name: string; command: string; args: string[]; env: Record<string, string> }>
): Promise<Client[]> {
  const cache = globalThis.__mcpCache;
  const requestedIds = new Set(servers.map((s) => s.id));

  // Clean up removed servers
  for (const id in cache) {
    if (!requestedIds.has(id)) {
      try {
        await cache[id].client.close();
      } catch (e) {
        console.error(`Failed to close MCP server ${id}`, e);
      }
      delete cache[id];
    }
  }

  // Connect or reuse requested servers
  for (const server of servers) {
    const isSameCommand =
      cache[server.id] &&
      cache[server.id].command === server.command &&
      cache[server.id].args.join(" ") === server.args.join(" ");

    if (!isSameCommand) {
      if (cache[server.id]) {
        await cache[server.id].client.close().catch(() => { });
        delete cache[server.id];
      }

      console.log(`Starting MCP server: ${server.name} (${server.command} ${server.args.join(" ")})`);
      const env = { ...process.env, ...server.env } as Record<string, string>;
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env,
      });

      const client = new Client(
        { name: "OrbitClient", version: "1.0.0" },
        { capabilities: {} }
      );

      const ready = client.connect(transport);
      cache[server.id] = {
        id: server.id,
        command: server.command,
        args: server.args,
        client,
        transport,
        ready,
      };
    }
  }

  // Wait for all active servers to be ready
  const activeClients: Client[] = [];
  for (const server of servers) {
    try {
      await cache[server.id].ready;
      activeClients.push(cache[server.id].client);
    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.name}`, e);
    }
  }

  return activeClients;
}
