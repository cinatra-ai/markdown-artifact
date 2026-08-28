import { defineConfig } from "vitest/config";

// jsdom so the renderer entries can be mounted in a real DOM. The automatic JSX
// runtime matches the tsconfig `jsx: "react-jsx"`.
export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
