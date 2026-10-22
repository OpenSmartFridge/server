import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      "windows.taila33aff.ts.net",
    ],

    https: {
      key: fs.readFileSync('./windows.taila33aff.ts.net.key'),
      cert: fs.readFileSync('./windows.taila33aff.ts.net.crt'),
    },

    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
