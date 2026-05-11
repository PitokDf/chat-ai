import type { NextConfig } from "next";

// WebContainers require cross-origin isolation.
// https://webcontainers.io/guides/quickstart#enabling-sharedarraybuffer
const isolationHeaders = [
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.23.96.211"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: isolationHeaders,
      },
    ];
  },
  // Monaco and xterm ship UMD assets that break SSR if bundled.
  serverExternalPackages: ["@webcontainer/api"],
};

export default nextConfig;
