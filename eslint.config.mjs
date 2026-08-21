import baseConfig from "@thread/config/eslint/base";

export default [
  ...baseConfig,
  {
    ignores: ["apps/**", "packages/**", "pictures/**"],
  },
];
