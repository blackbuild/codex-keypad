import { defineConfig } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  entry: {
    'live-state': 'src/control-surface/live-state.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  bundle: true,
  splitting: false,
  platform: 'node',
  target: 'es2022',
  noExternal: [/.*/],
  minify: isProduction,
  sourcemap: !isProduction,
  onSuccess: async () => console.log('✅ TS build completed.'),
});
