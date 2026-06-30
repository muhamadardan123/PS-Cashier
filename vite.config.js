import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Naikkan batas peringatan chunk size (dari 500kB ke 1000kB)
    chunkSizeWarningLimit: 1000,
    
    // Optimasi code splitting dengan Rollup
    rollupOptions: {
      output: {
        manualChunks: {
          // Pisahkan library besar ke chunk terpisah
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})