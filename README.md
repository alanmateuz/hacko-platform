# hacko↗

**O seu próximo desafio é aqui.** A hacko é uma plataforma de hackathons: participantes encontram eventos, montam equipes e entregam projetos; empresas publicam hackathons e acompanham inscritos, equipes e entregas em um só lugar.

Em produção em **[hacko.com.br](https://hacko.com.br)** · página de apresentação em **[hacko.com.br/sobre](https://hacko.com.br/sobre)**.

## Funcionalidades

### Para participantes

- **Conta própria:** cadastro com e-mail e senha (com medidor de força), ou login com Google e GitHub. Recuperação de senha por e-mail, logout e exclusão de conta.
- **Perfil em blocos:** foto, cidade, bio, stack, área (DEV, DESIGN, MARKETING ou NEGÓCIOS), faculdade e/ou trabalho e até duas redes sociais clicáveis (LinkedIn, GitHub, Portfólio ou Instagram). O participante escolhe o tema do cartão (azul + branco ou preto + verde), visível para todos. Visibilidade na comunidade é opcional.
- **Explorar:** banner rotativo com os hackathons em destaque (oficiais da hacko primeiro), busca por nome/tema, cidade, formato e datas, e linhas com rolagem lateral para **Oficiais da hacko** e **Fora da hacko**.
- **Inscrição** com aceite do regulamento e cancelamento até o início do evento. "Meus hackathons" mostra as inscrições com a etiqueta *Confirmado*.
- **Equipes:** criar equipe (com descrição obrigatória, áreas procuradas e tema de cor), pedir para entrar, aceitar/recusar pedidos, sair ou dissolver. Card "Sua equipe" na página do evento.
- **Convidar:** na página do hackathon, o líder de uma equipe em formação vê o botão *Convidar* nos participantes que ainda não têm equipe.
- **Filtros por área** nas equipes e nos participantes de cada hackathon, com até três blocos por linha e rolagem lateral.
- **Entregas:** qualquer integrante anexa fotos, PDFs (até 20 MB) e links; o líder confirma o envio e acompanha o status (aguardando envio → confirmada → em validação → validada / revisar envio).
- **Comunidade:** perfis públicos com filtros, e **Radar com IA** para encontrar oportunidades na web com fontes para conferir.
- **Notificações** no sino do topo e confirmações em um popup no visual da hacko.

### Para empresas

- **Conta de empresa** com perfil da organização: nome, logo, site, CNPJ, cidade, redes e responsável.
- **Hackathons:** criar, editar, duplicar, publicar e arquivar, com regras, datas, vagas, tamanho de equipe, prazo de entrega e capa.
- **Cor do banner:** 7 cores da paleta ou uma cor personalizada (seletor de cor ou código hexadecimal), com prévia ao vivo e contraste automático do texto.
- **Fora da hacko:** marcar um hackathon como externo (inscrição oficial no site do organizador, equipes formadas aqui).
- **Painel do evento:** inscritos de A–Z ou por equipe, equipes com status, entregas com anexos e validação (em validação, validada ou pedir ajustes com comentário).
- **Inscritos e equipes** de todos os eventos da empresa em uma visão.
- **TeamMatch:** sugestão de equipes para quem ficou sem time, com revisão e aprovação pela organização.

### Landing page (`/sobre`)

Apresentação para participantes e empresas, com navegação por seções, carrossel dos hackathons ativos (atualizado automaticamente), planos, perguntas frequentes e contatos.

## Tecnologia

| Camada | Uso |
|---|---|
| Front-end | React (SPA com rotas por hash) em `app/hacko.tsx`; landing em `app/sobre/` |
| Servidor | Vinext (app router estilo Next) em **Cloudflare Workers** |
| API | `app/api/hacko/route.ts` (`GET ?action=` e `POST {op}`), autenticação em `app/api/auth/*` |
| Banco | **Cloudflare D1** (SQLite) com migrações Drizzle em `drizzle/` |
| Arquivos | **Cloudflare R2** (bucket `hacko-files`) para anexos das entregas; imagens de capa, logo e avatar no D1 |
| E-mail | Resend (recuperação de senha) |

Segurança: senhas com PBKDF2, sessões guardadas apenas como hash, cookies HttpOnly, CSRF por origem, autorização verificada no servidor por organização e objeto, tipo de arquivo conferido pelo conteúdo e limites de inscrição/equipe garantidos por índices únicos e verificações SQL em batch transacional.

## Estrutura

```
app/
  hacko.tsx            app principal (participantes e empresas)
  sobre/               landing page
  api/hacko/route.ts   API da plataforma
  api/auth/*           cadastro, login, OAuth, logout, recuperação de senha
  api/files            download de anexos das entregas
  privacidade/ termos/ páginas legais
lib/                   autenticação, entregas (R2), validação (zod), domínio
db/schema.ts           esquema do banco
drizzle/               migrações SQL
tests/                 testes da API
public/                marca, favicon e imagens da landing
```

## Rodar localmente

Requisitos: Node 22.13+ e pnpm.

```bash
pnpm install
pnpm dev
```

O site abre em `http://localhost:5173`. Verificações:

```bash
pnpm test
```

```bash
pnpm check
```

```bash
pnpm build
```

Ao alterar `db/schema.ts`, gere a migração com `pnpm db:generate`.

## Deploy

Cada pull request roda testes e build no GitHub Actions. O merge na `main` aplica as migrações do D1 e publica o Worker em hacko.com.br automaticamente. Detalhes e configuração inicial da Cloudflare em [DEPLOY.md](DEPLOY.md).

Segredos do Worker:

| Variável | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login com Google |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Login com GitHub |
| `RESEND_API_KEY` | E-mail de recuperação de senha |
| `OPENAI_API_KEY` | Radar com IA (opcional; sem ela o radar fica desativado) |

Nenhum segredo vai para o front-end; arquivos `.env*` são ignorados pelo Git.

## Testes

`tests/phase01.test.mjs` executa os handlers reais da API sobre SQLite em memória e um R2 simulado. Cobre autenticação, CSRF, isolamento entre organizações, rascunhos ocultos, privacidade de perfil, vagas, inscrição idempotente, uma equipe por evento, tamanho mínimo/máximo, permissões do líder, descrição obrigatória da equipe, entregas com anexos, contas de empresa e TeamMatch com 20, 100 e 300 participantes.

## Identidade visual

Azul `#0367FC`, verde-limão `#D2F801`, branco `#FFFFFF` e preto `#161616`. Tipografia Space Grotesk (títulos) e Manrope (texto). Wordmark `hacko↗`, ícone `h↗` e padrão de setas ↗ verde / ↙ azul.

Fotos ilustrativas com licença Unsplash: George Dagerotip (https://unsplash.com/photos/gQxpuAU6mLU), Jj Englert (https://unsplash.com/photos/H2pfrqhQou8) e Creatopy (https://unsplash.com/photos/M35xxKGb_tA).
