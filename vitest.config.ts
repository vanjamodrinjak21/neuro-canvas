import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
// Ships with Nuxt's vite builder — enables mounting .vue SFCs in unit tests.
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['app/**/*.test.ts', 'server/**/*.test.ts', 'partykit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '#imports': resolve(__dirname, '.nuxt/imports.d.ts'),
    },
  },
})
