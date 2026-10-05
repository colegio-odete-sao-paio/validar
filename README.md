# Validação de Certificados — Colégio Odete São Paio

> ⚠️ **NÃO APAGUE ESTE REPOSITÓRIO NEM DESATIVE O GITHUB PAGES** sem antes remover o registro
> `validar` no DNS do Registro.br. Os QR Codes de todos os certificados emitidos apontam para
> `https://validar.odetesaopaio.com.br`. Remover a página com o DNS ainda apontando permite que
> outra pessoa publique uma página falsa nesse endereço.

## O que é

Página pública que confere a autenticidade dos certificados emitidos pelo colégio.
Ela lê o token do QR Code (`?v=TOKEN`) e pergunta ao Google Apps Script do colégio
(conta `certificados@odetesaopaio.com.br`) se o certificado existe e está válido.

**Este repositório não contém nenhum dado pessoal, token ou senha — e nunca deve conter.**
Nada de planilhas, listas de nomes, listas de links ou tokens aqui.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | Página de validação |
| `app.js` | Consulta ao Apps Script; a URL da implantação fica na primeira configuração do arquivo |
| `estilo.css`, `assets/` | Visual, logotipo e fontes (tudo hospedado aqui, sem serviços de terceiros) |
| `CNAME` | Domínio próprio: `validar.odetesaopaio.com.br` |
| `robots.txt` | Pede aos buscadores que não indexem a página |
| `404.html` | Página para endereços inexistentes |

## Regras de segurança

- Nenhum script, fonte, imagem ou rastreador de outro site (a política de segurança da página bloqueia).
- Dados recebidos são exibidos só como texto.
- Verificação em duas etapas obrigatória para todos os membros da organização.
- Toda alteração aqui deve ser revisada: quem controla esta página controla o que ela responde.

## Contato

Responsável técnico: equipe de TI do Colégio Odete São Paio.
