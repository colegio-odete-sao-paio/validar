/*
 * Validação de certificados — Colégio Odete São Paio
 * Lê o token do endereço (?v=TOKEN), pergunta ao Google Apps Script e mostra o resultado.
 * Regras de segurança deste arquivo:
 *  - os dados recebidos são exibidos só como texto (textContent), nunca como HTML;
 *  - o token só é enviado se tiver o formato esperado;
 *  - nenhum cookie, nenhum rastreador, nenhum arquivo de outro site.
 */
(function () {
  'use strict';

  // ÚNICA linha a alterar na implantação: URL do app da Web (termina em /exec)
  var URL_VALIDACAO = 'https://script.google.com/macros/s/AKfycbyWMMlGFtogiQLJ8LmSsF_wPWtwSwgMVhHFdvbHKN8Crv6-73hYFX6b0yRkT_oSu6PNBg/exec';

  var FORMATO_TOKEN = /^[A-Z0-9]{20,40}$/;
  // O Google às vezes demora ou perde uma requisição: cada tentativa tem seu limite
  // e a página tenta de novo sozinha (consulta só de leitura, repetir é seguro).
  var TEMPO_TENTATIVA_MS = 12000;
  var TENTATIVAS = 3;
  var PAUSA_ENTRE_TENTATIVAS_MS = 800;
  var AVISO_APOS_MS = 4000;
  var ESTADOS = ['carregando', 'valido', 'cancelado', 'nao_encontrado', 'sem_token', 'erro'];

  // Se alguém exibir esta página dentro de outro site (quadro), não mostra nada.
  if (window.top !== window.self) {
    document.documentElement.className += ' emquadro';
    return;
  }

  function mostrar(estado, dados) {
    if (ESTADOS.indexOf(estado) === -1) estado = 'erro';
    var blocos = document.querySelectorAll('[data-estado]');
    for (var i = 0; i < blocos.length; i++) {
      blocos[i].hidden = blocos[i].getAttribute('data-estado') !== estado;
    }
    if (estado === 'valido') {
      texto('v-nome', dados.nome);
      texto('v-evento', dados.evento);
      texto('v-data', dados.data);
      texto('v-codigo', dados.codigo);
    }
  }

  function texto(id, valor) {
    document.getElementById(id).textContent = String(valor).slice(0, 200);
  }

  function respostaValida(d) {
    if (!d || typeof d !== 'object' || ESTADOS.indexOf(d.estado) === -1) return false;
    if (d.estado !== 'valido') return true;
    return ['nome', 'evento', 'data', 'codigo'].every(function (k) {
      return typeof d[k] === 'string' && d[k].length > 0 && d[k].length <= 200;
    });
  }

  var token = (new URLSearchParams(window.location.search).get('v') || '').trim();

  if (!token) { mostrar('sem_token'); return; }
  if (!FORMATO_TOKEN.test(token)) { mostrar('nao_encontrado'); return; }

  // Se demorar, avisa que está tudo certo e é só aguardar.
  var aviso = setTimeout(function () {
    var el = document.getElementById('aguarde');
    if (el) el.hidden = false;
  }, AVISO_APOS_MS);

  function consultar() {
    var controle = ('AbortController' in window) ? new AbortController() : null;
    var relogio = setTimeout(function () { if (controle) controle.abort(); }, TEMPO_TENTATIVA_MS);
    return fetch(URL_VALIDACAO + '?v=' + encodeURIComponent(token), {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: controle ? controle.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(relogio);
        // 'erro' vindo do servidor também merece nova tentativa
        if (!respostaValida(d) || d.estado === 'erro') throw new Error('resposta inválida');
        return d;
      }, function (e) { clearTimeout(relogio); throw e; });
  }

  function tentar(n) {
    return consultar().catch(function (e) {
      if (n >= TENTATIVAS) throw e;
      return new Promise(function (ok) { setTimeout(ok, PAUSA_ENTRE_TENTATIVAS_MS); })
        .then(function () { return tentar(n + 1); });
    });
  }

  tentar(1)
    .then(function (d) { mostrar(d.estado, d); })
    .catch(function () { mostrar('erro'); })
    .then(function () { clearTimeout(aviso); });
})();
