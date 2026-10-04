import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import compression from "compression";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "compressed-preview",
      configurePreviewServer(server) {
        server.middlewares.use(
          compression() as unknown as Connect.NextHandleFunction,
        );
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { target: "es2022" },
  server: { port: 5173 },
  preview: { port: 4173 },
});
