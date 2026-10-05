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
  var TEMPO_LIMITE_MS = 15000;
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

  var controle = ('AbortController' in window) ? new AbortController() : null;
  var relogio = setTimeout(function () { if (controle) controle.abort(); }, TEMPO_LIMITE_MS);

  fetch(URL_VALIDACAO + '?v=' + encodeURIComponent(token), {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    signal: controle ? controle.signal : undefined
  })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) { mostrar(respostaValida(d) ? d.estado : 'erro', d); })
    .catch(function () { mostrar('erro'); })
    .then(function () { clearTimeout(relogio); });
})();
