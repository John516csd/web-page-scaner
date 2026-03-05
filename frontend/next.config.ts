import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4001/api/:path*",
      },
      {
        source: "/ws/:path*",
        destination: "http://localhost:4001/ws/:path*",
      },
    ];
  },
};

export default nextConfig;
