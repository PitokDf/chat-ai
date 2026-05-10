"use client";

import { getDb } from "@/lib/db";
import { getWebContainer } from "@/lib/webcontainer/boot";

const STORAGE_KEY = "orbit-install-cache";

type CacheShape = Record<string, string>;

const readCache = (): CacheShape => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as CacheShape;
  } catch {
    // ignore
  }
  return {};
};

const writeCache = (cache: CacheShape) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage quota or unavailable; skip silently.
  }
};

/**
 * Stable, order-independent hash over the parts of package.json that affect
 * the install output. Formatting-only changes don't invalidate the cache.
 */
export const fingerprintDeps = (pkgJson: string): string => {
  let parsed: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    overrides?: Record<string, string>;
    resolutions?: Record<string, string>;
  };
  try {
    parsed = JSON.parse(pkgJson);
  } catch {
    return "invalid";
  }
  const stable = {
    dependencies: sortObj(parsed.dependencies),
    devDependencies: sortObj(parsed.devDependencies),
    peerDependencies: sortObj(parsed.peerDependencies),
    optionalDependencies: sortObj(parsed.optionalDependencies),
    overrides: sortObj(parsed.overrides),
    resolutions: sortObj(parsed.resolutions),
  };
  return simpleHash(JSON.stringify(stable));
};

const sortObj = (obj?: Record<string, string>) => {
  if (!obj) return {};
  const out: Record<string, string> = {};
  for (const key of Object.keys(obj).sort()) out[key] = obj[key];
  return out;
};

/** Tiny FNV-1a 32-bit hash. */
const simpleHash = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

/**
 * Return true if node_modules exists in the WebContainer and is non-empty.
 */
export const hasNodeModules = async (): Promise<boolean> => {
  try {
    const wc = await getWebContainer();
    const entries = await wc.fs.readdir("node_modules");
    return entries.length > 0;
  } catch {
    return false;
  }
};

export const getCachedFingerprint = (projectId: string): string | null => {
  const cache = readCache();
  return cache[projectId] ?? null;
};

export const setCachedFingerprint = (
  projectId: string,
  fingerprint: string,
) => {
  const cache = readCache();
  cache[projectId] = fingerprint;
  writeCache(cache);
};

export const clearCachedFingerprint = (projectId: string) => {
  const cache = readCache();
  if (!(projectId in cache)) return;
  delete cache[projectId];
  writeCache(cache);
};

export type InstallDecision =
  | { skip: true; reason: string }
  | { skip: false; fingerprint: string };

/**
 * Decide whether an `npm install` run inside this project can be skipped.
 */
export const evaluateInstall = async (
  projectId: string,
  packageJson: string,
): Promise<InstallDecision> => {
  const fingerprint = fingerprintDeps(packageJson);
  if (fingerprint === "invalid") {
    return { skip: false, fingerprint };
  }
  const cached = getCachedFingerprint(projectId);
  if (cached !== fingerprint) {
    return { skip: false, fingerprint };
  }
  const installed = await hasNodeModules();
  if (!installed) {
    return { skip: false, fingerprint };
  }
  return { skip: true, reason: "deps unchanged and node_modules exists" };
};

export const readContainerPackageJson = async (): Promise<string | null> => {
  try {
    const wc = await getWebContainer();
    return await wc.fs.readFile("package.json", "utf-8");
  } catch {
    return null;
  }
};

/**
 * Capture a binary snapshot of node_modules and stash it in IndexedDB tied
 * to the fingerprint we just installed for. Fire-and-forget; failures don't
 * block the user - we just miss the fast path on next refresh.
 */
export const snapshotNodeModules = async (
  projectId: string,
  fingerprint: string,
): Promise<void> => {
  try {
    const wc = await getWebContainer();
    const bin = await wc.export("node_modules", { format: "binary" });
    const payload = bin instanceof Uint8Array ? bin : new Uint8Array(bin);
    await getDb().nodeModules.put({
      projectId,
      fingerprint,
      payload,
      updatedAt: Date.now(),
    });
  } catch {
    // Export can fail on huge trees; cache is best-effort.
  }
};

/**
 * If we have a saved node_modules snapshot whose fingerprint matches the
 * current package.json, mount it back into the WebContainer and return true.
 */
export const tryMountNodeModulesSnapshot = async (
  projectId: string,
  fingerprint: string,
): Promise<boolean> => {
  try {
    const record = await getDb().nodeModules.get(projectId);
    if (!record || record.fingerprint !== fingerprint) return false;
    const wc = await getWebContainer();
    // Ensure node_modules dir exists before mounting a subtree into it.
    try {
      await wc.fs.mkdir("node_modules", { recursive: true });
    } catch {
      // ignore: already present
    }
    await wc.mount(record.payload, { mountPoint: "node_modules" });
    return true;
  } catch {
    return false;
  }
};

export const clearNodeModulesSnapshot = async (projectId: string) => {
  try {
    await getDb().nodeModules.delete(projectId);
  } catch {
    // ignore
  }
};
