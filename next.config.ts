import type { NextConfig } from "next";

// Static export for GitHub Pages; served from /<repo>/ in production
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isPages ? "/running-coach" : "",
  images: { unoptimized: true },
};

export default nextConfig;
