import js from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import tsEslint from "typescript-eslint";
import globals from "globals";

const config = [
  js.configs.recommended,
  prettierConfig,
  {
    // Used without any other keys (besides name), act as global ignores.
    ignores: ["**/node_modules/", "**/fixtures/", "**/dist/"],
  },
  {
    name: "eslint/default",
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],

    plugins: {
      prettier: prettierPlugin,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.es2022,
      },
    },

    rules: {
      semi: ["error", "always"],
      "spaced-comment": [2, "always"],
      "arrow-body-style": ["error", "as-needed"],

      "no-use-before-define": [
        "error",
        {
          functions: false,
        },
      ],

      "no-unused-vars": [
        "error",
        {
          args: "after-used",
        },
      ],

      "no-else-return": "error",
    },
  },

  ...tsEslint.config({
    name: "eslint/typescript",
    files: ["**/*.{ts,tsx}"],
    extends: [tsEslint.configs.recommended],
    rules: {},
  }),
];

export default config;
