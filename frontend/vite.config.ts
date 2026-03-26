import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // allows import from "@/components/..."
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000", // your backend
        changeOrigin: true,
      },
    },
  },
});
