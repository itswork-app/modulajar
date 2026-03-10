import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/test-wizard',
        destination: '/wizard',
        permanent: true,
      },
      {
        source: '/w/:workspaceId/modules/new',
        destination: '/wizard',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
