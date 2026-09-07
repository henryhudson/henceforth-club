import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.mjs'],
    // The board scripts default to the real ledger in the Deck repository,
    // which the launchd autosync mirrors to the live store. Point them at a
    // folder that does not exist so no test can write it.
    env: { BOARD_VIEWER_DIR: path.resolve(__dirname, './.vitest/no-board-viewer') },
  }
})
