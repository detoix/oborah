import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@engine/map",
    "@obora/design",
    "@obora/catalog",
    "react-three-map",
    "three",
  ],
};

export default nextConfig;
