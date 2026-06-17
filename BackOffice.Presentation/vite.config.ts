/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  // Use environment variable or fallback to localhost for development
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:5041'

  return {
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          icon: true,
          exportType: "named",
          namedExport: "ReactComponent",
        },
      }),
    ],
    optimizeDeps: {
      include: [
        "@mui/x-data-grid",
        "@mui/material",
        "@emotion/react",
        "@emotion/styled",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: ["localhost", ".replit.dev", ".repl.co", "45.58.39.38:9096", "rdt-back-office-react-2-faisal2006e.replit.app"],
      proxy: {
        "/RDTBackOfficeAPI": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        },
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: true,
    },
  }
})