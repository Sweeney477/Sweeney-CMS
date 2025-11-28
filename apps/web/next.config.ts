import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default nextConfig;
