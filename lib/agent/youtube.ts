import { tool } from "ai";
import { z } from "zod";

const YOUTUBE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

type VideoResult = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: number;
  views: number;
};

const parseDuration = (text: string): number => {
  const parts = text.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

const parseViews = (text: string): number => {
  const match = text.match(/([\d.,]+)\s*(views?|x)?/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ""));
  const lower = text.toLowerCase();
  if (lower.includes("billion") || lower.includes("miliar")) return num * 1_000_000_000;
  if (lower.includes("million") || lower.includes("jt")) return num * 1_000_000;
  if (lower.includes("k") || lower.includes("rb")) return num * 1_000;
  return num;
};

const searchYouTube = async (query: string): Promise<VideoResult[]> => {
  const res = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgW4AQAB`,
    {
      headers: YOUTUBE_HEADERS,
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!res.ok) {
    throw new Error(`YouTube returned ${res.status}.`);
  }

  const html = await res.text();

  const match = html.match(/var\s+ytInitialData\s*=\s*({[\s\S]*?});\s*<\/script>/);
  if (!match) {
    throw new Error("Failed to parse YouTube search results.");
  }

  const data = JSON.parse(match[1]) as Record<string, unknown>;
  const results: VideoResult[] = [];

  const twoColumn = (data.contents as Record<string, unknown>)?.twoColumnSearchResultsRenderer as
    | Record<string, unknown>
    | undefined;
  const primary = twoColumn?.primaryContents as Record<string, unknown> | undefined;
  const sectionList = (primary?.sectionListRenderer as Record<string, unknown>)?.contents as
    | Record<string, unknown>[]
    | undefined;

  if (!sectionList) return results;

  for (const section of sectionList) {
    const itemSection = section?.itemSectionRenderer;
    if (!itemSection) continue;

    const items = (itemSection as Record<string, unknown>).contents as
      | Record<string, unknown>[]
      | undefined;
    if (!items) continue;

    for (const item of items) {
      const renderer =
        (item as Record<string, unknown>).videoRenderer ??
        (item as Record<string, unknown>).reelItemRenderer;
      if (!renderer) continue;

      const videoId = (renderer as Record<string, string>).videoId;
      if (!videoId) continue;

      const titleObj = (renderer as Record<string, unknown>).title as
        | Record<string, unknown>
        | undefined;
      const titleText =
        ((titleObj?.runs as { text: string }[])?.[0]?.text ??
          (titleObj as Record<string, string>)?.simpleText ??
          "Untitled") as string;

      const ownerObj = (renderer as Record<string, unknown>).ownerText as
        | Record<string, unknown>
        | undefined;
      const ownerText =
        ((ownerObj?.runs as { text: string }[])?.[0]?.text ?? "Unknown") as string;

      const lengthObj = (renderer as Record<string, unknown>).lengthText as
        | Record<string, string>
        | undefined;
      const lengthText = (lengthObj?.simpleText ?? "0:00") as string;

      const viewObj = (renderer as Record<string, unknown>).viewCountText as
        | Record<string, string>
        | undefined;
      const viewText = (viewObj?.simpleText ?? "0 views") as string;

      const thumbObj = (renderer as Record<string, unknown>).thumbnail as
        | Record<string, { url: string; width: number; height: number }[]>
        | undefined;
      const thumbnails = thumbObj?.thumbnails ?? [];
      const bestThumb =
        thumbnails.find((t) => t.width >= 320) ?? thumbnails[thumbnails.length - 1];

      results.push({
        videoId,
        title: titleText,
        author: ownerText,
        thumbnail:
          bestThumb?.url ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        duration: parseDuration(lengthText),
        views: parseViews(viewText),
      });

      if (results.length >= 8) break;
    }

    if (results.length >= 8) break;
  }

  return results;
};

export const youtubeMusicTool = tool({
  description:
    "Search YouTube for songs, music videos, and audio content. Use action 'search' with a query to find songs (e.g. { action: 'search', query: 'Tadow' }). Results include videoId, title, author, thumbnail, and duration. The user can then play any result directly in the app. ALWAYS call this tool when the user asks to play music, search for a song, or mentions 'putar lagu', 'mainkan musik', 'play song'.",
  inputSchema: z.object({
    action: z
      .enum(["search", "getInfo"])
      .describe(
        '"search" to find songs by query. "getInfo" to get metadata for a specific videoId.',
      ),
    query: z
      .string()
      .optional()
      .describe("Search query for songs (required for search action)."),
    videoId: z
      .string()
      .optional()
      .describe("YouTube video ID (required for getInfo action)."),
  }),
  execute: async ({ action, query, videoId }) => {
    try {
      if (action === "search") {
        if (!query) {
          return { error: "Query is required for search action." };
        }

        const results = await searchYouTube(query);

        return {
          action: "search",
          query,
          count: results.length,
          results,
        };
      }

      if (action === "getInfo") {
        if (!videoId) {
          return { error: "videoId is required for getInfo action." };
        }

        return {
          action: "getInfo",
          videoId,
          title: "Unknown",
          author: "Unknown",
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          duration: 0,
          views: 0,
        };
      }

      return { error: "Unknown action. Use 'search' or 'getInfo'." };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
