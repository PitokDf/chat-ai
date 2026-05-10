import Dexie, { type EntityTable } from "dexie";

import type { ProviderId } from "@/lib/providers";

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastProviderId?: ProviderId;
  lastModelId?: string;
};

export type MessageRole = "user" | "assistant" | "system";

export type MessageRecord = {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  providerId?: ProviderId;
  modelId?: string;
  /** JSON-serialized array of ChatToolCall. Stored as a string to avoid
   *  Dexie trying to index the nested object. */
  toolCalls?: string;
};

export type FileSnapshotRecord = {
  projectId: string;
  path: string;
  content: string;
  updatedAt: number;
};

/**
 * Binary snapshot of node_modules captured after a successful npm install.
 * Mounted back into the WebContainer on restore so we don't have to install
 * again after a page refresh.
 */
export type NodeModulesRecord = {
  projectId: string;
  fingerprint: string;
  payload: Uint8Array;
  updatedAt: number;
};

class OrbitDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, "id">;
  messages!: EntityTable<MessageRecord, "id">;
  // Compound primary key [projectId+path]; use a synthetic "id" string field
  // in practice we address by the key tuple via Dexie's API.
  files!: Dexie.Table<FileSnapshotRecord, [string, string]>;
  nodeModules!: EntityTable<NodeModulesRecord, "projectId">;

  constructor() {
    super("orbit-db");
    this.version(1).stores({
      projects: "id, updatedAt",
      messages: "id, projectId, createdAt, [projectId+createdAt]",
      files: "[projectId+path], projectId",
    });
    // v2 adds node_modules cache. Pre-existing projects keep all other data.
    this.version(2).stores({
      projects: "id, updatedAt",
      messages: "id, projectId, createdAt, [projectId+createdAt]",
      files: "[projectId+path], projectId",
      nodeModules: "projectId",
    });
  }
}

let dbInstance: OrbitDatabase | null = null;

export const getDb = (): OrbitDatabase => {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
  if (!dbInstance) {
    dbInstance = new OrbitDatabase();
  }
  return dbInstance;
};
