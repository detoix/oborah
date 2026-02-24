import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    "@engine/map",
    "@oborah/design",
    "@oborah/catalog",
    "react-three-map",
    "three",
  ],
};

export default nextConfig;
