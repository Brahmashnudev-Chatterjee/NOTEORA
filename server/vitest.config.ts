import {defineConfig} from 'vitest/config'
export default defineConfig({test:{include:['src/**/*.test.ts'],testTimeout:20000,hookTimeout:120000,maxWorkers:2}})
