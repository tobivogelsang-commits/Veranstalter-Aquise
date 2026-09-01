import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Beleg-Fotos (Team-App) und Mail-Anhänge kommen als FormData über
      // Server Actions - der Standard von 1 MB ist dafür zu knapp.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
