import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: [".ntli/", ".netlify/", ".cache/", "node_modules/"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/**/*.ts", "vite.config.ts", "tailwind.config.ts"],
    ignores: ["src/ui/**", "src/edge-functions/**"],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
);
