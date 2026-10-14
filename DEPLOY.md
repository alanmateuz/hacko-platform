# Publicar a Hacko em hacko.com.br (Cloudflare)

A Hacko roda como Cloudflare Worker com banco D1. O login é próprio: cadastro com e-mail e senha (sempre disponível) e, opcionalmente, Google, GitHub e LinkedIn.
Cada botão de provedor só aparece quando as chaves daquele provedor estão configuradas.

## 1. Chaves dos provedores de login

Em todos, a URL de retorno (redirect / callback) é `https://hacko.com.br/api/auth/<provedor>`.
Para testar localmente, adicione também `http://localhost:5173/api/auth/<provedor>`.

| Provedor | Onde criar | URL de retorno | Segredos |
|---|---|---|---|
| Google | console.cloud.google.com → APIs e serviços → Tela de consentimento OAuth (Externo) → Credenciais → ID do cliente OAuth → Aplicativo da Web | `https://hacko.com.br/api/auth/google` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | github.com/settings/developers → OAuth Apps → New OAuth App (Homepage: `https://hacko.com.br`) | `https://hacko.com.br/api/auth/github` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| LinkedIn | linkedin.com/developers/apps → Create app (exige uma Página da empresa no LinkedIn) → aba Products: **Sign In with LinkedIn using OpenID Connect** → aba Auth | `https://hacko.com.br/api/auth/linkedin` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |

## 2. Primeira publicação

```bash
npx wrangler login
npx wrangler d1 create hacko-db
```

Copie o `database_id` mostrado e use nos comandos abaixo (PowerShell: `$env:HACKO_D1_ID="..."`; bash: `export HACKO_D1_ID=...`):

```bash
HACKO_D1_ID=<id> HACKO_DOMAIN=hacko.com.br pnpm deploy
HACKO_D1_ID=<id> HACKO_DOMAIN=hacko.com.br pnpm db:migrate:prod
```

Depois cadastre os segredos (cada comando pede o valor):

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --name hacko-platform
npx wrangler secret put GOOGLE_CLIENT_SECRET --name hacko-platform
npx wrangler secret put GITHUB_CLIENT_ID --name hacko-platform
npx wrangler secret put GITHUB_CLIENT_SECRET --name hacko-platform
npx wrangler secret put LINKEDIN_CLIENT_ID --name hacko-platform
npx wrangler secret put LINKEDIN_CLIENT_SECRET --name hacko-platform
npx wrangler secret put OPENAI_API_KEY --name hacko-platform   # opcional, para o Radar
```

O domínio `hacko.com.br` precisa estar **Active** na Cloudflare; o deploy cria os registros de `hacko.com.br` e `www.hacko.com.br`.

## 3. Próximas publicações

`HACKO_D1_ID=<id> HACKO_DOMAIN=hacko.com.br pnpm deploy`, e `pnpm db:migrate:prod` sempre que houver migração nova em `drizzle/`.

## Desenvolvimento local

`pnpm dev`.
Chaves locais vão em `.dev.vars` (ignorado pelo Git).
