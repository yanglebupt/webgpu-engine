import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import WGSSLPlugin from "./vite-plugins/webgpu-structural-shader-language";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [topLevelAwait(), WGSSLPlugin()],
  base: "./",
  server: {
    host: "0.0.0.0",
  },
});
