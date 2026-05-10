/**
 * Git import endpoint.
 *
 * Accepts a public GitHub-style repo URL, downloads its zipball via the
 * GitHub API, and returns a JSON payload of { path, content } entries the
 * client can feed into the WebContainer FS.
 *
 * Supports plain GitHub URLs like:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo/tree/branch
 */

import { unzipSync, strFromU8 } from "fflate";

export const runtime = "nodejs";

type ImportedFile = { path: string; content: string };

const BINARY_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "pdf",
  "zip",
  "tar",
  "gz",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "mp3",
  "mp4",
  "wav",
]);

const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 15_000_000;

type ParsedRepo = {
  owner: string;
  repo: string;
  ref?: string;
};

const parseRepoUrl = (raw: string): ParsedRepo | null => {
  try {
    const url = new URL(raw);
    if (url.hostname !== "github.com") return null;
    const [owner, repo, maybeTree, ...rest] = url.pathname
      .replace(/^\//, "")
      .replace(/\.git$/, "")
      .split("/");
    if (!owner || !repo) return null;
    const ref =
      maybeTree === "tree" && rest.length > 0 ? rest.join("/") : undefined;
    return { owner, repo, ref };
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const repoUrl = typeof body?.url === "string" ? body.url : "";
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return Response.json(
      { error: "Provide a valid public GitHub URL." },
      { status: 400 },
    );
  }

  const { owner, repo, ref } = parsed;
  const refPath = ref ? `/${encodeURIComponent(ref)}` : "";
  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball${refPath}`;

  let res: Response;
  try {
    res = await fetch(zipUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "orbit-agent",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error.";
    return Response.json({ error: message }, { status: 502 });
  }

  if (!res.ok) {
    return Response.json(
      { error: `GitHub returned ${res.status} ${res.statusText}.` },
      { status: 502 },
    );
  }

  const buffer = new Uint8Array(await res.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unzip failed.";
    return Response.json({ error: message }, { status: 500 });
  }

  const files: ImportedFile[] = [];
  let totalBytes = 0;

  for (const [rawPath, data] of Object.entries(entries)) {
    if (rawPath.endsWith("/")) continue;
    // GitHub zipball wraps everything in a top-level "owner-repo-sha/" folder.
    const stripped = rawPath.replace(/^[^/]+\//, "");
    if (!stripped) continue;
    if (stripped.startsWith(".git/")) continue;
    if (data.length > MAX_FILE_BYTES) continue;

    const ext = stripped.split(".").pop()?.toLowerCase() ?? "";
    if (BINARY_EXTS.has(ext)) continue;

    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return Response.json(
        { error: "Repo exceeds 15MB decoded size limit." },
        { status: 413 },
      );
    }
    try {
      const content = strFromU8(data);
      files.push({ path: stripped, content });
    } catch {
      // Skip files that are not valid UTF-8.
    }
  }

  return Response.json({
    owner,
    repo,
    ref: ref ?? "default",
    files,
  });
}
