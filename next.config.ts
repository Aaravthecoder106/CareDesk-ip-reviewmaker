import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project. Without this, Next infers
  // the root from the nearest lockfile and incorrectly selects a parent-directory
  // lockfile (e.g. the user's home folder), producing a build-time warning.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
