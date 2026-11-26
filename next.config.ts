import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Este app é 100% dinâmico (tudo depende de sessão/cookies de auth),
  // então o Cache Components (prerender estático) não ajuda aqui e só
  // exigiria Suspense boundaries em toda página — desligado de propósito.
  cacheComponents: false,
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
