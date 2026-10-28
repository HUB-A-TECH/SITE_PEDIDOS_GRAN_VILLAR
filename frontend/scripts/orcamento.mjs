// Orçamento de tamanho do site: falha (código 1) se o que o celular baixa na
// primeira tela passar dos limites. Uso: npm run orcamento (depois do build).
// Quem decide subir um limite é o dono, de propósito — ver docs/auditoria-3g.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LIMITES_KB = { js: 115, css: 8, total: 130 }; // gzip, só o que a 1ª tela baixa

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const unicos = [...new Set(refs)];

let js = 0;
let css = 0;
const kb = (n) => (n / 1024).toFixed(1);
for (const ref of unicos) {
  const arq = join(dist, ref);
  if (!existsSync(arq)) {
    console.error(`FALTA o arquivo ${ref} citado no index.html`);
    process.exit(1);
  }
  const gz = gzipSync(readFileSync(arq), { level: 9 }).length;
  if (ref.endsWith('.css')) css += gz;
  else js += gz;
  console.log(`  ${ref.padEnd(40)} ${kb(gz).padStart(7)} KB gzip`);
}
const total = js + css + gzipSync(html).length;
console.log(`JS ${kb(js)} KB (limite ${LIMITES_KB.js}) | CSS ${kb(css)} KB (limite ${LIMITES_KB.css}) | total ${kb(total)} KB (limite ${LIMITES_KB.total})`);

const estouros = [];
if (js / 1024 > LIMITES_KB.js) estouros.push('JS');
if (css / 1024 > LIMITES_KB.css) estouros.push('CSS');
if (total / 1024 > LIMITES_KB.total) estouros.push('total');
if (estouros.length) {
  console.error(`ORÇAMENTO ESTOURADO: ${estouros.join(', ')}. Telas de admin devem usar lazy; subir o limite é decisão do dono.`);
  process.exit(1);
}
console.log('Orçamento OK.');
