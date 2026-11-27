import { build } from 'esbuild';
import fs from 'fs';

fs.mkdirSync('api', { recursive: true });

await build({
  entryPoints: ['src/server/vercel.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  outfile: 'api/index.js',
  sourcemap: false,
  logLevel: 'info',
});
