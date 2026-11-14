import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  turbopack: { root: __dirname },
};

export default config;
