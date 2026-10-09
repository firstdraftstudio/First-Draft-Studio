import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        privacy: resolve(process.cwd(), 'privacy.html'),
        terms: resolve(process.cwd(), 'terms.html'),
        refunds: resolve(process.cwd(), 'refunds.html'),
        serviceDelivery: resolve(process.cwd(), 'service-delivery.html'),
        contactGrievance: resolve(process.cwd(), 'contact-grievance.html')
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
})
