/*
 * Validação de certificados — Colégio Odete São Paio
 * Lê o token do endereço (?v=TOKEN), busca o arquivo cifrado daquele certificado
 * neste próprio site e o decifra aqui no navegador, com o próprio token.
 *
 * Regras de segurança deste arquivo:
 *  - o token nunca sai do navegador (só um identificador derivado dele, de mão única);
 *  - o arquivo só é aceito se o selo de integridade conferir (qualquer alteração é recusada);
 *  - os dados são exibidos só como texto (textContent), nunca como HTML;
 *  - nenhum cookie, nenhum rastreador, nenhum arquivo ou serviço de outro site.
 *
 * Esquema "osp-cert-v1" — idêntico ao Publicacao.gs (Apps Script).
 */
(function () {
  'use strict';

  var PREFIXO = 'osp-cert-v1|';
  var PASTA = 'c/';
  var FORMATO_TOKEN = /^[A-Z0-9]{20,40}$/;
  var TENTATIVAS = 3;
  var TEMPO_TENTATIVA_MS = 10000;
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
    if (!d || typeof d !== 'object') return false;
    if (d.estado === 'cancelado') return true;
    if (d.estado !== 'valido') return false;
    return ['nome', 'evento', 'data', 'codigo'].every(function (k) {
      return typeof d[k] === 'string' && d[k].length > 0 && d[k].length <= 200;
    });
  }

  /* ---------- cifra (WebCrypto) ---------- */

  var cod = new TextEncoder();

  function hmac(chave, msg) {
    return crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, msg); })
      .then(function (s) { return new Uint8Array(s); });
  }

  function juntar() {
    var total = 0, i, partes = arguments;
    for (i = 0; i < partes.length; i++) total += partes[i].length;
    var r = new Uint8Array(total), p = 0;
    for (i = 0; i < partes.length; i++) { r.set(partes[i], p); p += partes[i].length; }
    return r;
  }

  function deB64(s) {
    var bin = atob(s), r = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) r[i] = bin.charCodeAt(i);
    return r;
  }

  function hex(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return s;
  }

  function iguais(a, b) {
    if (a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
  }

  function chaves(token) {
    var t = cod.encode(token);
    return Promise.all(['id', 'enc', 'mac'].map(function (n) { return hmac(t, cod.encode(PREFIXO + n)); }))
      .then(function (k) { return { id: hex(k[0]), enc: k[1], mac: k[2] }; });
  }

  function decifrar(k, arq) {
    if (!arq || arq.v !== 1 || typeof arq.n !== 'string' || typeof arq.c !== 'string' || typeof arq.t !== 'string') {
      return Promise.reject(new Error('formato'));
    }
    var nonce = deB64(arq.n), cifrado = deB64(arq.c), selo = deB64(arq.t);
    if (nonce.length !== 16 || cifrado.length > 4096) return Promise.reject(new Error('formato'));
    return hmac(k.mac, juntar(cod.encode('v1'), nonce, cifrado)).then(function (esperado) {
      if (!iguais(esperado, selo)) throw new Error('selo');          // arquivo alterado ou de outro certificado
      var blocos = [];
      for (var b = 0; b * 32 < cifrado.length; b++) {
        blocos.push(hmac(k.enc, juntar(nonce, new Uint8Array([b >>> 24 & 255, b >>> 16 & 255, b >>> 8 & 255, b & 255]))));
      }
      return Promise.all(blocos).then(function (fluxos) {
        var claro = new Uint8Array(cifrado.length);
        for (var i = 0; i < cifrado.length; i++) claro[i] = cifrado[i] ^ fluxos[i >> 5][i & 31];
        return JSON.parse(new TextDecoder().decode(claro));
      });
    });
  }

  /* ---------- consulta ---------- */

  function buscar(id) {
    var controle = ('AbortController' in window) ? new AbortController() : null;
    var relogio = setTimeout(function () { if (controle) controle.abort(); }, TEMPO_TENTATIVA_MS);
    return fetch(PASTA + id + '.json', {
      method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: controle ? controle.signal : undefined
    }).then(function (r) {
      clearTimeout(relogio);
      if (r.status === 404) return null;                              // não existe: não encontrado
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(relogio); throw e; });
  }

  function buscarComNovasTentativas(id, n) {
    return buscar(id).catch(function (e) {
      if (n >= TENTATIVAS) throw e;
      return new Promise(function (ok) { setTimeout(ok, 700 * n); })
        .then(function () { return buscarComNovasTentativas(id, n + 1); });
    });
  }

  var token = (new URLSearchParams(window.location.search).get('v') || '').trim();

  if (!token) { mostrar('sem_token'); return; }
  if (!FORMATO_TOKEN.test(token)) { mostrar('nao_encontrado'); return; }
  if (!window.crypto || !crypto.subtle || !window.TextEncoder) { mostrar('erro'); return; }

  var aviso = setTimeout(function () {
    var el = document.getElementById('aguarde');
    if (el) el.hidden = false;
  }, AVISO_APOS_MS);

  chaves(token)
    .then(function (k) {
      return buscarComNovasTentativas(k.id, 1).then(function (arq) {
        if (arq === null) return { estado: 'nao_encontrado' };
        return decifrar(k, arq);
      });
    })
    .then(function (d) {
      if (d.estado === 'nao_encontrado') mostrar('nao_encontrado');
      else mostrar(respostaValida(d) ? d.estado : 'erro', d);
    })
    .catch(function () { mostrar('erro'); })
    .then(function () { clearTimeout(aviso); });
})();
