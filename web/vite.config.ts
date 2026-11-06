import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  server: {
    port: 7270,
    host: true,
    // /mcp too: agent prompts point at the origin the browser is using. Keep
    // the Host header so the API builds agent URLs on this port, not 7246.
    proxy: {
      "/api": { target: "http://localhost:7246", changeOrigin: false },
      "/mcp": { target: "http://localhost:7246", changeOrigin: false },
    },
  },
});
