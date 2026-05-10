"use client";

import type { ParsedAction } from "@/lib/agent/parser";
import { normalizeActionContent } from "@/lib/agent/parser";
import {
  clearCachedFingerprint,
  clearNodeModulesSnapshot,
  evaluateInstall,
  readContainerPackageJson,
  setCachedFingerprint,
  snapshotNodeModules,
  tryMountNodeModulesSnapshot,
} from "@/lib/agent/install-cache";
import { getDb } from "@/lib/db";
import { useWorkspace } from "@/lib/store/workspace";
import {
  getWebContainer,
  runCommand,
  startProcess,
  writeFile,
} from "@/lib/webcontainer/boot";

const sysLog = (text: string, stream: "system" | "stderr" = "system") =>
  useWorkspace.getState().appendTerminal({ stream, text });

/** Ensure the WebContainer has booted and is listening for events. */
let listenersAttached = false;

export const ensureWorkspaceReady = async () => {
  const store = useWorkspace.getState();
  if (store.status === "ready" || store.status === "running") return;

  store.setStatus("booting");
  sysLog("Booting WebContainer...");

  const wc = await getWebContainer();

  if (!listenersAttached) {
    listenersAttached = true;
    wc.on("server-ready", (_port, url) => {
      useWorkspace.getState().setPreview(url);
      useWorkspace.getState().setStatus("running");
      sysLog(`Preview ready at ${url}`);
    });
    wc.on("error", ({ message }) => {
      sysLog(`WebContainer error: ${message}`, "stderr");
      useWorkspace.getState().setStatus("error");
    });
  }

  store.setStatus("ready");
  sysLog("WebContainer ready.");
};

const persistFile = async (
  projectId: string,
  path: string,
  content: string,
) => {
  try {
    await getDb().files.put({
      projectId,
      path,
      content,
      updatedAt: Date.now(),
    });
  } catch {
    // Snapshotting is best-effort; primary source of truth is the container FS.
  }
};

export type ExecuteOptions = {
  projectId: string;
  /** When true, ignore cached fingerprint and node_modules snapshot. */
  forceInstall?: boolean;
};

export type ExecuteResult = {
  note?: string;
};

const isInstallCommand = (command: string): boolean => {
  const first = command.trim().split(/\s+/).slice(0, 2).join(" ");
  return (
    first === "npm install" ||
    first === "npm i" ||
    first === "npm ci" ||
    first === "pnpm install" ||
    first === "pnpm i" ||
    first === "yarn" ||
    first === "yarn install" ||
    first === "bun install" ||
    first === "bun i"
  );
};

const runInstall = async (
  projectId: string,
  command: string,
  packageJsonText: string,
  forceInstall: boolean,
): Promise<ExecuteResult> => {
  // 1) Try to reuse the persisted node_modules snapshot first (survives
  //    across page reloads where the WebContainer itself is torn down).
  if (!forceInstall) {
    const decision = await evaluateInstall(projectId, packageJsonText);
    if (decision.skip) {
      sysLog(`$ ${command}`);
      sysLog(`(cached: ${decision.reason})`);
      useWorkspace.getState().setStatus("ready");
      return { note: "cached" };
    }

    // Fingerprint matches something we installed before, but node_modules is
    // missing in the fresh container. Attempt to mount the binary snapshot.
    const mounted = await tryMountNodeModulesSnapshot(
      projectId,
      decision.fingerprint,
    );
    if (mounted) {
      sysLog(`$ ${command}`);
      sysLog("(restored node_modules from cache)");
      setCachedFingerprint(projectId, decision.fingerprint);
      useWorkspace.getState().setStatus("ready");
      return { note: "restored" };
    }
  }

  const decision = await evaluateInstall(projectId, packageJsonText);
  const nextFingerprint = decision.skip === false ? decision.fingerprint : "";

  sysLog(`$ ${command}`);
  useWorkspace.getState().setStatus("installing");
  const result = await runCommand(command, (chunk) => {
    useWorkspace.getState().appendTerminal({ stream: "stdout", text: chunk });
  });
  if (result.exitCode === 0 && nextFingerprint) {
    setCachedFingerprint(projectId, nextFingerprint);
    // Snapshot node_modules in the background for next page reload.
    void snapshotNodeModules(projectId, nextFingerprint);
  } else if (result.exitCode !== 0) {
    sysLog(`exit ${result.exitCode}`, "stderr");
    // A failed install leaves behind partial state; clear the cache so we
    // don't fool ourselves next time.
    clearCachedFingerprint(projectId);
    await clearNodeModulesSnapshot(projectId);
  }
  useWorkspace.getState().setStatus("ready");
  return { note: forceInstall ? "reinstalled" : undefined };
};

/**
 * Execute a single parsed action against the WebContainer and project state.
 */
export const executeAction = async (
  action: ParsedAction,
  { projectId, forceInstall = false }: ExecuteOptions,
): Promise<ExecuteResult> => {
  await ensureWorkspaceReady();
  const content = normalizeActionContent(action.content);

  switch (action.type) {
    case "file": {
      if (!action.filePath) {
        sysLog("File action missing filePath.", "stderr");
        return {};
      }
      await writeFile(action.filePath, content);
      useWorkspace.getState().upsertFile(action.filePath, content);
      await persistFile(projectId, action.filePath, content);
      sysLog(`wrote ${action.filePath}`);
      return {};
    }
    case "shell": {
      const command = content.trim();
      if (!command) return {};

      if (isInstallCommand(command)) {
        const pkgJson = await readContainerPackageJson();
        if (pkgJson) {
          return runInstall(projectId, command, pkgJson, forceInstall);
        }
      }

      sysLog(`$ ${command}`);
      useWorkspace.getState().setStatus("installing");
      const result = await runCommand(command, (chunk) => {
        useWorkspace.getState().appendTerminal({
          stream: "stdout",
          text: chunk,
        });
      });
      if (result.exitCode !== 0) {
        sysLog(`exit ${result.exitCode}`, "stderr");
      }
      useWorkspace.getState().setStatus("ready");
      return {};
    }
    case "start": {
      const command = content.trim();
      if (!command) return {};

      const state = useWorkspace.getState();
      if (state.devProcess && state.currentStart === command) {
        sysLog(`(dev server already running: ${command})`);
        return { note: "already running" };
      }
      if (state.devProcess) {
        sysLog(`Restarting dev server...`);
        state.devProcess.kill();
      }

      sysLog(`$ ${command}`);
      const process = await startProcess(command, (chunk) => {
        useWorkspace.getState().appendTerminal({
          stream: "stdout",
          text: chunk,
        });
      });
      useWorkspace.getState().setDevProcess(process, command);
      useWorkspace.getState().setStatus("running");
      return {};
    }
    case "preview": {
      // Render self-contained HTML in the preview iframe via a blob URL.
      // Kill the dev server if one was running so the iframe doesn't race.
      const state = useWorkspace.getState();
      if (state.devProcess) {
        state.devProcess.kill();
        state.setDevProcess(null, null);
      }
      if (state.previewBlobUrl) {
        URL.revokeObjectURL(state.previewBlobUrl);
      }
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      state.setPreview(url);
      state.setPreviewBlobUrl(url);
      state.setStatus("running");
      sysLog("Rendered HTML preview.");
      return { note: "preview" };
    }
  }
};

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const pickStartScript = (pkg: PackageJson): string | null => {
  const scripts = pkg.scripts ?? {};
  if (scripts.dev) return "npm run dev";
  if (scripts.start) return "npm run start";
  if (scripts.preview) return "npm run preview";
  return null;
};

const hasDeps = (pkg: PackageJson) =>
  Object.keys(pkg.dependencies ?? {}).length > 0 ||
  Object.keys(pkg.devDependencies ?? {}).length > 0;

/**
 * Rehydrate the WebContainer FS from an IndexedDB snapshot and optionally
 * boot the dev server. Called when reopening a project.
 */
export const restoreProjectToContainer = async (
  projectId: string,
): Promise<void> => {
  await ensureWorkspaceReady();

  const snapshots = await getDb()
    .files.where("projectId")
    .equals(projectId)
    .toArray();

  if (snapshots.length === 0) return;

  useWorkspace.getState().setStatus("installing");
  sysLog(`Restoring ${snapshots.length} files into the sandbox...`);

  let packageJson: PackageJson | null = null;
  let packageJsonText: string | null = null;
  for (const file of snapshots) {
    try {
      await writeFile(file.path, file.content);
      useWorkspace.getState().upsertFile(file.path, file.content);
      if (file.path === "package.json") {
        packageJsonText = file.content;
        try {
          packageJson = JSON.parse(file.content) as PackageJson;
        } catch {
          // Malformed package.json: skip auto-install.
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      sysLog(`Failed to restore ${file.path}: ${message}`, "stderr");
    }
  }

  if (!packageJson || !packageJsonText) {
    useWorkspace.getState().setStatus("ready");
    sysLog("Files restored. No package.json found, skipping dev server.");
    return;
  }

  if (hasDeps(packageJson)) {
    const decision = await evaluateInstall(projectId, packageJsonText);
    if (decision.skip) {
      sysLog(`(cached: ${decision.reason}, skipping npm install)`);
    } else {
      // Try to mount the node_modules snapshot before running install.
      const mounted = await tryMountNodeModulesSnapshot(
        projectId,
        decision.fingerprint,
      );
      if (mounted) {
        sysLog("(restored node_modules from cache, skipping npm install)");
        setCachedFingerprint(projectId, decision.fingerprint);
      } else {
        sysLog("$ npm install");
        const result = await runCommand("npm install", (chunk) => {
          useWorkspace.getState().appendTerminal({
            stream: "stdout",
            text: chunk,
          });
        });
        if (result.exitCode !== 0) {
          sysLog(`npm install exited ${result.exitCode}`, "stderr");
          useWorkspace.getState().setStatus("error");
          return;
        }
        setCachedFingerprint(projectId, decision.fingerprint);
        void snapshotNodeModules(projectId, decision.fingerprint);
      }
    }
  }

  const startCommand = pickStartScript(packageJson);
  if (!startCommand) {
    useWorkspace.getState().setStatus("ready");
    sysLog("Files restored. No dev/start script to run.");
    return;
  }

  const state = useWorkspace.getState();
  if (state.devProcess) state.devProcess.kill();

  sysLog(`$ ${startCommand}`);
  const process = await startProcess(startCommand, (chunk) => {
    useWorkspace.getState().appendTerminal({ stream: "stdout", text: chunk });
  });
  useWorkspace.getState().setDevProcess(process, startCommand);
  useWorkspace.getState().setStatus("running");
};

/**
 * Force a clean reinstall: wipe node_modules in the container and the saved
 * snapshot, clear the fingerprint, then run npm install.
 */
export const forceReinstall = async (projectId: string): Promise<void> => {
  await ensureWorkspaceReady();
  const pkgJson = await readContainerPackageJson();
  if (!pkgJson) {
    sysLog("No package.json in the sandbox; nothing to install.", "stderr");
    return;
  }

  sysLog("Force reinstall requested");
  clearCachedFingerprint(projectId);
  await clearNodeModulesSnapshot(projectId);
  try {
    const wc = await getWebContainer();
    const rm = await wc.spawn("jsh", ["-c", "rm -rf node_modules"]);
    await rm.exit;
  } catch {
    // ignore
  }

  await runInstall(projectId, "npm install", pkgJson, true);
};
