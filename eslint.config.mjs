import nodeConfig from "@thread/config/eslint/node";

export default [
  ...nodeConfig,
  {
    ignores: ["apps/**", "packages/**", "pictures/**"],
  },
];
