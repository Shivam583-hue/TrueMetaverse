import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // the http api runs on :3000; the ws server on :3001 is dialed directly
      "/api": "http://localhost:3000",
    },
  },
});
