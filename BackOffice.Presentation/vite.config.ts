/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"
import compression from "vite-plugin-compression"

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
      // Gzip compression for production assets
      compression({
        algorithm: "gzip",
        ext: ".gz",
        threshold: 1024,
      }),
      // Brotli compression for production assets
      compression({
        algorithm: "brotliCompress",
        ext: ".br",
        threshold: 1024,
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
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ["console.log", "console.info", "console.debug"],
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-redux": ["@reduxjs/toolkit", "react-redux"],
            "vendor-mui": ["@mui/material", "@mui/system", "@emotion/react", "@emotion/styled"],
            "vendor-mui-grid": ["@mui/x-data-grid"],
            "vendor-mui-date": ["@mui/x-date-pickers"],
            "vendor-charts": ["apexcharts", "react-apexcharts"],
            "vendor-ag-grid": ["ag-grid-community", "ag-grid-react"],
            "vendor-pdf": ["jspdf", "jspdf-autotable"],
            "vendor-calendar": [
              "@fullcalendar/core",
              "@fullcalendar/daygrid",
              "@fullcalendar/interaction",
              "@fullcalendar/list",
              "@fullcalendar/react",
              "@fullcalendar/timegrid",
            ],
            "vendor-utils": ["axios", "dayjs", "lodash.debounce", "classnames", "clsx"],
          },
        },
      },
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