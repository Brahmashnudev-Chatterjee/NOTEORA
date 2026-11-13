import {defineConfig} from 'vitest/config'
// Persistent suites share the explicitly supplied disposable schema/queue.
// Prevent a queue worker in one file claiming another file's fixture deliveries.
export default defineConfig({test:{include:['test/**/*.test.ts'],fileParallelism:false,testTimeout:15000,hookTimeout:60000}})
