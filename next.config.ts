import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@slack/socket-mode", "@slack/web-api", "ws"],
};

export default nextConfig;
