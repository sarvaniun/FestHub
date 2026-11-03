import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The embedding model library uses native code (onnxruntime-node), so
  // Next must load it from node_modules instead of bundling it.
  serverExternalPackages: ["@huggingface/transformers"],
};

export default nextConfig;
