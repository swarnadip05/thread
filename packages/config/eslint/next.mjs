import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

export default [
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  {
    ignores: [".next/**", "dist/**", "coverage/**", "next-env.d.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
