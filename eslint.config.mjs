// import { defineConfig } from "eslint/config";
import stylistic from '@stylistic/eslint-plugin'
import tseslint from "typescript-eslint";
import vuePlugin from "eslint-plugin-vue";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs([
  tseslint.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    plugins: {
      '@stylistic': stylistic
    },
    files: [
      "server/src/**/*{.ts,tsx}",
      "client/src/**/*{.ts,tsx}"
    ],
    rules: {
      semi: "error",
      '@stylistic/indent': ['error', 2],
      "prefer-const": "error",
      "@typescript-eslint/no-explicit-any": "off"
    },
  },
]);

// import globals from "globals";
// import pluginJs from "@eslint/js";
// import tseslint from "typescript-eslint";


/** @type {import('eslint').Linter.Config[]} */
// export default [
//   { files: ["app/assets/javascripts/**/*.{ts,tsx}"] },
//   { languageOptions: { globals: globals.browser } },
//   pluginJs.configs.recommended,
//   ...tseslint.configs.recommended,
//   {
//     rules: {
//       "@typescript-eslint/no-explicit-any": "off",
//       "@typescript-eslint/explicit-function-return-type": "error",
//       "no-unused-vars": "off",
//       "@typescript-eslint/no-unused-vars": [
//         "warn",
//         {
//           "argsIgnorePattern": "^_[^_].*$|^_$",
//           "varsIgnorePattern": "^_[^_].*$|^_$",
//           "caughtErrorsIgnorePattern": "^_[^_].*$|^_$"
//         }
//       ],
//       "@typescript-eslint/no-this-alias": "off"
//     },
//   }
// ];
