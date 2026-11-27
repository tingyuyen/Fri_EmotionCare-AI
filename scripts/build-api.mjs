import { build } from 'esbuild';
import fs from 'fs';

fs.mkdirSync('api', { recursive: true });

// Ensure api/index.ts never coexists with api/index.js on Vercel
if (fs.existsSync('api/index.ts')) {
  fs.unlinkSync('api/index.ts');
}

await build({
  entryPoints: ['src/server/vercel.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  outfile: 'api/index.js',
  sourcemap: false,
  logLevel: 'info',
});
