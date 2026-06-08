import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["yjs", "y-protocols", "lib0"],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // Single Yjs instance — required for y-monaco + client sync
    config.resolve.alias.yjs = path.resolve(__dirname, "node_modules/yjs");
    return config;
  },
};

export default nextConfig;
