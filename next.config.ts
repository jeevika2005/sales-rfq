import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 10MB. Our own 25MB file-upload limit (FR-3.3) becomes
    // ~33MB once base64-encoded in the JSON body, so this needs headroom
    // above that or the proxy layer silently truncates large PDFs before
    // our own size-limit error ever gets a chance to run.
    proxyClientMaxBodySize: 40 * 1024 * 1024,
  },
};

export default nextConfig;
