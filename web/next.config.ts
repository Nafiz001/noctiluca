import type { NextConfig } from "next";

// The Django backend. REST calls go through Next so the browser never needs
// CORS; the live websocket connects to the backend directly.
const backend = process.env.NOCTILUCA_BACKEND ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // The dev badge sits right on top of the depth readout.
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
