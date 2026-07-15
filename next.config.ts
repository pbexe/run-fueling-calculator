import type { NextConfig } from "next";

import { resolveBasePath } from "./src/config/basePath";

const nextConfig: NextConfig = {
  output: "export",
  basePath: resolveBasePath(process.env.NODE_ENV),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
