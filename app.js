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
  // O Google às vezes demora (2 a 20 s) ou perde uma requisição. Estratégia:
  // nunca abandona uma consulta em andamento; se demorar, dispara outra em paralelo
  // e usa a primeira resposta que chegar (consulta só de leitura, repetir é seguro).
  var DISPAROS_MS = [0, 7000, 15000];   // momentos de cada consulta (no máximo 3)
  var TEMPO_TOTAL_MS = 45000;           // depois disso, mostra "não foi possível validar"
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

  var controles = [];

  function consultar() {
    var controle = ('AbortController' in window) ? new AbortController() : null;
    if (controle) controles.push(controle);
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
        // 'erro' vindo do servidor também conta como falha desta consulta
        if (!respostaValida(d) || d.estado === 'erro') throw new Error('resposta inválida');
        return d;
      });
  }

  var terminou = false, disparadas = 0, falhas = 0, agendados = [];

  function encerrar(estado, dados) {
    if (terminou) return;
    terminou = true;
    clearTimeout(aviso);
    clearTimeout(limite);
    agendados.forEach(clearTimeout);
    controles.forEach(function (c) { try { c.abort(); } catch (e) {} });
    mostrar(estado, dados);
  }

  function disparar() {
    if (terminou || disparadas >= DISPAROS_MS.length) return;
    disparadas++;
    consultar().then(
      function (d) { encerrar(d.estado, d); },
      function () {
        falhas++;
        if (terminou) return;
        if (disparadas < DISPAROS_MS.length) disparar();         // falhou: não espera, tenta já
        else if (falhas >= disparadas) encerrar('erro');         // todas falharam
      }
    );
  }

  DISPAROS_MS.forEach(function (ms, i) {
    if (i === 0) disparar();
    else agendados.push(setTimeout(disparar, ms));
  });
  var limite = setTimeout(function () { encerrar('erro'); }, TEMPO_TOTAL_MS);
})();
