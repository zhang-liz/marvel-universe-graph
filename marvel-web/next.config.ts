import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The FalkorDB client breaks when bundled (its Redis layer needs native BigInt handling), so load it from node_modules.
  serverExternalPackages: ["falkordb"],
};

export default nextConfig;
