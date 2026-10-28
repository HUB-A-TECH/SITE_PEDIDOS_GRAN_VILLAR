/**
 * Conferência rápida DEPOIS de uma subida (só leitura: não cria nem altera nada).
 * Uso:  SITE=https://gran-villar.onrender.com USUARIO=... SENHA=... node tests/ferramentas/conferir-no-ar.mjs
 * Verifica: site abre, arquivos em cache certo, saúde, login, sessão, catálogo e
 * telas do menu. Sai com código 1 se algo falhar.
 */
const SITE = (process.env.SITE ?? 'http://127.0.0.1:3333').replace(/\/$/, '');
const { USUARIO, SENHA } = process.env;

let falhas = 0;
const ok = (nome, cond, extra = '') => {
  console.log(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`);
  if (!cond) falhas++;
};
const medir = async (fn) => {
  const t = Date.now();
  const r = await fn();
  return [r, Date.now() - t];
};

const [home, msHome] = await medir(() => fetch(SITE + '/'));
ok('página inicial abre', home.status === 200, `${msHome} ms`);
ok('index.html sem cache longo', /no-cache/.test(home.headers.get('cache-control') ?? ''));
const html = await home.text();
const js = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
if (js) {
  const r = await fetch(SITE + js);
  ok('JS do site com cache longo', /immutable/.test(r.headers.get('cache-control') ?? ''));
}
const [saude, msSaude] = await medir(() => fetch(SITE + '/api/health'));
ok('saúde do servidor', saude.status === 200, `${msSaude} ms`);

if (!USUARIO || !SENHA) {
  console.log('(sem USUARIO/SENHA: pulando login e telas)');
} else {
  const login = await fetch(SITE + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USUARIO, password: SENHA }),
  });
  ok('login', login.status === 200);
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const get = (rota) => medir(() => fetch(SITE + rota, { headers: { cookie } }));
  for (const rota of ['/api/auth/me', '/api/pedidos/resumo-menu', '/api/clientes', '/api/pedidos/historico']) {
    const [r, ms] = await get(rota);
    // resumo-menu só existe para vendedor; 403 para administração é o esperado
    ok(`GET ${rota}`, r.status === 200 || (rota.includes('resumo') && r.status === 403), `${r.status}, ${ms} ms`);
  }
  await fetch(SITE + '/api/auth/logout', { method: 'POST', headers: { cookie } });
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
