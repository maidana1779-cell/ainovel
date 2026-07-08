import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/ainovel",
  assetPrefix: "/ainovel/",
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
