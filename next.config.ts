import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  // 开发期允许的访问来源（只写 hostname，不写协议和端口）。
  // Next.js 默认放行「启动时的 hostname」+ localhost，但当 dev server 绑定
  // 0.0.0.0 时，localhost 有时不被识别，导致：
  //   - 手机用 IP 访问正常
  //   - 电脑用 localhost 访问时按钮点不动（hydration 失效）
  // 这里两种来源都显式列出。
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "172.20.10.4",
    "192.168.*.*",
    "10.*.*.*",
  ],
  experimental: {
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
