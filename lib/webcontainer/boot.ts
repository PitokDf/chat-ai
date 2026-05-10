"use client";

import type { WebContainer, WebContainerProcess } from "@webcontainer/api";

/**
 * Boot and reuse a single WebContainer instance for the lifetime of the tab.
 * WebContainers can only be booted once per page.
 */
let bootPromise: Promise<WebContainer> | null = null;
let instance: WebContainer | null = null;

export const getWebContainer = async (): Promise<WebContainer> => {
  if (instance) return instance;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    const { WebContainer } = await import("@webcontainer/api");
    const wc = await WebContainer.boot({ workdirName: "orbit" });
    instance = wc;
    return wc;
  })();

  return bootPromise;
};

export const isWebContainerReady = () => instance !== null;

/**
 * Recursively write a file, creating parent directories if they don't exist.
 */
export const writeFile = async (path: string, content: string) => {
  const wc = await getWebContainer();
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(path, content);
};

export type CommandResult = {
  exitCode: number;
  output: string;
};

/**
 * Run a command to completion, collecting stdout/stderr.
 * Uses "jsh" (WebContainer's shell) so we can pass a single string.
 */
export const runCommand = async (
  command: string,
  onOutput?: (chunk: string) => void,
): Promise<CommandResult> => {
  const wc = await getWebContainer();
  const process = await wc.spawn("jsh", ["-c", command]);

  let output = "";
  const writer = new WritableStream<string>({
    write(chunk) {
      output += chunk;
      onOutput?.(chunk);
    },
  });
  process.output.pipeTo(writer).catch(() => {
    // Stream may close before we're done reading; that's fine.
  });

  const exitCode = await process.exit;
  return { exitCode, output };
};

/**
 * Start a long-running process (dev server). Caller is responsible for killing
 * the previous one when starting a new instance.
 */
export const startProcess = async (
  command: string,
  onOutput?: (chunk: string) => void,
): Promise<WebContainerProcess> => {
  const wc = await getWebContainer();
  const process = await wc.spawn("jsh", ["-c", command]);
  if (onOutput) {
    const writer = new WritableStream<string>({
      write(chunk) {
        onOutput(chunk);
      },
    });
    process.output.pipeTo(writer).catch(() => {});
  }
  return process;
};
