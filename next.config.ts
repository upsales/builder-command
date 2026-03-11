import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  instrumentationHook: true,
  serverExternalPackages: ["@slack/socket-mode", "@slack/web-api", "ws"],
};

export default nextConfig;
