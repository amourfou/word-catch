/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next 14 for instrumentation.ts (server boot hook)
  experimental: {
    instrumentationHook: true,
    // Keep web-push (Node http/https/net) out of the webpack graph
    serverComponentsExternalPackages: ["web-push"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // instrumentation / API routes: load web-push from node_modules at runtime
      if (Array.isArray(config.externals)) {
        config.externals.push("web-push");
      }
    } else {
      // Client must never resolve Node built-ins pulled transitively
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        http: false,
        https: false,
        net: false,
        tls: false,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
