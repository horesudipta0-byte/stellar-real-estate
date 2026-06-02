/** @type {import('next').NextConfig} */
const nextConfig = {
  // Stellar SDK requires certain Node.js modules that are not available in the browser.
  // We need to polyfill/ignore them for client-side builds.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        buffer: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
