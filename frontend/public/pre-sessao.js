// Pergunta "quem está logado?" já no começo do carregamento, em paralelo com o
// download do site (no 3G isso economiza ~1 s). O AuthContext usa a resposta; se
// falhar ou não existir, ele pergunta de novo pelo caminho normal.
window.__sessao = fetch('/api/auth/me', { credentials: 'same-origin' })
  .then(function (r) {
    if (r.status !== 200) return { status: r.status };
    return r.json().then(function (j) {
      return { status: 200, usuario: j.usuario };
    });
  })
  .catch(function () {
    return null;
  });
