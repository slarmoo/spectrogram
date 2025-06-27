// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [],
    base: '',
    build: {
        outDir: '../',
        minify: false,
        rollupOptions: {
            output: { //unhashed file names
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name][extname]',
            },
        }
    },
})
