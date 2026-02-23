import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@engine/map", "@obora/design", "@obora/catalog"],
};

export default nextConfig;
