import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Node 25+ has a built-in localStorage global that is undefined without --localstorage-file and hides jsdom's, so turn it off.
const nodeMajor = Number(process.versions.node.split('.')[0])
const testExecArgv = nodeMajor >= 25 ? ['--no-experimental-webstorage'] : []

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './Testing/setupTests.js',
    include: ['src/**/*.test.{js,jsx}', 'Testing/**/test*.{js,jsx}'],
    poolOptions: {
      forks: { execArgv: testExecArgv },
      threads: { execArgv: testExecArgv },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      reporter: ['text', 'html'],
    },
  },
})
