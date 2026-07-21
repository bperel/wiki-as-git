// Shared flat ESLint config for the whole monorepo.
// Each package's eslint.config.mjs imports and extends this.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
// `/recommended` enables the `prettier/prettier` rule (Prettier runs as an
// ESLint rule) and turns off core rules that would conflict with Prettier
// (it bundles eslint-config-prettier).
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
    },
    rules: {
      // TypeScript's compiler already reports undefined identifiers, and the
      // core rule has no type information about ambient/DOM/Node globals.
      "no-undef": "off",
      // Allow deliberately-unused bindings prefixed with an underscore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // CommonJS scripts legitimately use require().
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Keep last so Prettier-conflicting rules are disabled after everything else.
  prettierRecommended,
  {
    // Build output is generated; never lint it.
    ignores: ["**/dist/**"],
  },
);
