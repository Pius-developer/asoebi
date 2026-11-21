// Backup build that doesn't need Vite (used when npm install isn't possible).
// Normal way: cd web && npm install && npm run build
//   node bin/build-without-vite.mjs
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const out = new URL('../public_html/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(out + 'assets', { recursive: true });
cpSync(new URL('../web/public/', import.meta.url).pathname, out, { recursive: true });

const globalModules = execSync('npm root -g').toString().trim();
const result = await build({
  entryPoints: [new URL('../web/src/main.jsx', import.meta.url).pathname],
  bundle: true, minify: true, format: 'esm', target: 'es2020',
  jsx: 'automatic', loader: { '.js': 'jsx' },
  outdir: out + 'assets', entryNames: 'app-[hash]', assetNames: '[name]-[hash]',
  external: ['/fonts/*'],
  nodePaths: [globalModules],
  define: { 'process.env.NODE_ENV': '"production"' },
  metafile: true,
});
const files = Object.keys(result.metafile.outputs).map((f) => f.split('/').pop());
const js = files.find((f) => f.endsWith('.js'));
const css = files.find((f) => f.endsWith('.css'));
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"></script>', `<script type="module" src="/assets/${js}"></script>`)
  .replace('</head>', `  <link rel="stylesheet" href="/assets/${css}">\n  </head>`);
writeFileSync(out + 'index.html', html);
console.log('Built', js, css);
