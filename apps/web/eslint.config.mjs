import nextConfig from "@thread/config/eslint/next";

export default [...nextConfig, { ignores: [".next-e2e/**"] }];
