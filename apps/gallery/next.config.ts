import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    void initOpenNextCloudflareForDev();
  });
}

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/shopify-design/index.html",
        },
      ],
    };
  },
};

export default nextConfig;
