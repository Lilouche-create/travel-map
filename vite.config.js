import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@maptiler/sdk', 'bcryptjs'],
  },
  resolve: {
    alias: {
      // bcryptjs uses a browser-compatible build automatically via its package.json "browser" field
    },
  },
  define: {
    // Provide a global crypto shim for bcryptjs in browser
    global: 'globalThis',
  },
})
