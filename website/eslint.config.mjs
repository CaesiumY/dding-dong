import globals from "globals";
import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignore patterns
  {
    ignores: ["dist/", ".astro/", "public/"],
  },

  // TypeScript recommended rules (non-type-checked)
  ...tseslint.configs.recommended,

  // Astro recommended rules
  ...eslintPluginAstro.configs.recommended,

  // Browser environment for source files
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Astro components (browser environment)
  {
    files: ["src/**/*.astro"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Node.js environment for config/scripts
  {
    files: ["astro.config.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Project-specific rule overrides
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
