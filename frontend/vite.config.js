import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "static",
  server: {
    allowedHosts: ["1381-150-228-207-117.ngrok-free.app","8367-150-228-207-117.ngrok-free.app"],
    port: 3000,
  },
});
