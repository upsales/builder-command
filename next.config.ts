import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  instrumentationHook: true,
  serverExternalPackages: ["@slack/socket-mode"],
};

export default nextConfig;
