import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: process.env.NO_API_PROXY ? undefined : {
      '/auth': 'http://127.0.0.1:8787',
      '/documents': 'http://127.0.0.1:8787',
      '/api': 'http://127.0.0.1:8787',
      '/api-docs': 'http://127.0.0.1:8787',
      '/json': 'http://127.0.0.1:8787',
      '/profile': 'http://127.0.0.1:8787',
      '/analytics': 'http://127.0.0.1:8787',
      '/admin': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
      '/ready': 'http://127.0.0.1:8787',
    },
  },
})
