import type { NextConfig } from "next";

// Sin `output: "export"`: la ruta /api/interpret necesita servidor (Vercel o `next start`).
const config: NextConfig = {
  turbopack: { root: __dirname },
};

export default config;
