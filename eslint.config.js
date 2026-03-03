import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.js"],
    ignores: ["node_modules/**", "dist/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      semi: ["error", "always"],
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
