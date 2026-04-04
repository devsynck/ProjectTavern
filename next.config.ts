import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
         protocol: 'https',
         hostname: 'avatars.charhub.io',
      },
      {
         protocol: 'https',
         hostname: 'files.catbox.moe',
      }
    ],
  },
};

export default nextConfig;
