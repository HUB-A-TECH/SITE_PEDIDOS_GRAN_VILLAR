// Freio de rede: imita Slow 3G (400 ms de espera, ~400 kbps) na frente do servidor local.
const http = require('http');
const zlib = require('zlib');
const ALVO = { host: '127.0.0.1', port: 3999 };
const estado = { offline: false, bloquear: [], latencia: 400, bytesPorSeg: 50000, log: [] };

function limitar(res, origem) {
  const passo = Math.max(1000, Math.floor(estado.bytesPorSeg / 10)); // 10 fatias por segundo
  let fila = Buffer.alloc(0), rodando = false;
  const bombear = () => {
    if (!fila.length) { rodando = false; if (origem.ended) res.end(); return; }
    rodando = true;
    res.write(fila.subarray(0, passo)); fila = fila.subarray(passo);
    setTimeout(bombear, 100);
  };
  origem.on('data', (c) => { fila = Buffer.concat([fila, c]); if (!rodando) bombear(); });
  origem.on('end', () => { origem.ended = true; if (!rodando) res.end(); });
}

http.createServer((req, res) => {
  if (req.url.startsWith('/__ctl')) {
    const u = new URL(req.url, 'http://x');
    const q = u.searchParams;
    if (q.has('offline')) estado.offline = q.get('offline') === '1';
    if (q.has('bloquear')) estado.bloquear = q.get('bloquear') ? q.get('bloquear').split(',') : [];
    if (q.has('latencia')) estado.latencia = Number(q.get('latencia'));
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ...estado, log: undefined, ultimas: estado.log.slice(-15) }));
  }
  const t0 = Date.now();
  const registrar = (cod, bytes) => estado.log.push(`${req.method} ${req.url.slice(0, 60)} -> ${cod} ${bytes ?? ''}B ${Date.now() - t0}ms`);
  if (estado.offline || estado.bloquear.some((p) => req.url.includes(p))) {
    registrar('CORTADA'); return setTimeout(() => req.socket.destroy(), 300);
  }
  const corpo = [];
  req.on('data', (c) => corpo.push(c));
  req.on('end', () => setTimeout(() => {
    const headers = { ...req.headers, host: `${ALVO.host}:${ALVO.port}`, 'accept-encoding': 'identity' };
    const p = http.request({ ...ALVO, method: req.method, path: req.url, headers }, (r) => {
      const h = { ...r.headers };
      const tipo = String(h['content-type'] || '');
      const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /(text|javascript|json|html|css)/.test(tipo);
      let saida = r;
      if (gz) { delete h['content-length']; h['content-encoding'] = 'gzip'; saida = r.pipe(zlib.createGzip()); }
      setTimeout(() => {
        res.writeHead(r.statusCode, h);
        let n = 0; saida.on('data', (c) => (n += c.length)); saida.on('end', () => registrar(r.statusCode, n));
        limitar(res, saida);
      }, estado.latencia);
    });
    p.on('error', () => { registrar('ERRO'); res.destroy(); });
    p.end(Buffer.concat(corpo));
  }, estado.latencia));
}).listen(4000, () => console.log('freio3g em http://localhost:4000'));
