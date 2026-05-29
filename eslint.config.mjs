import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build outputs — generated bundles, never hand-edited.
    "dist-electron/**",
    "mcp-server/dist/**",
    "release/**",
    // Vendored third-party JS shipped inside the Python virtualenv
    // (matplotlib/torch/sklearn web assets) — not our code.
    "python-venv/**",
  ]),
  {
    // React Compiler advisory rules (shipped as errors by eslint-config-next
    // 16). This app isn't compiled with React Compiler and uses idiomatic
    // patterns these flag — e.g. lazy-reading localStorage/matchMedia into
    // state inside an effect, or reading the clock during render. Keep them
    // visible as warnings rather than build-breaking errors; revisit if/when
    // we adopt the compiler.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
]);

export default eslintConfig;
