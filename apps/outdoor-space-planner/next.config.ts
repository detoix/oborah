import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactCompiler: true,
  transpilePackages: [
    "@oborah/geo",
    "@oborah/map",
    "@oborah/design",
    "@oborah/catalog",
    "react-three-map",
    "three",
  ],
};

export default nextConfig;
