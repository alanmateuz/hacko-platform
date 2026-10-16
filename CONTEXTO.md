# Contexto do projeto hacko — resumo da sessão

Plataforma de hackathons em **hacko.com.br**. Os participantes encontram eventos e formam equipes; as empresas organizam eventos e validam entregas.
Repositório: `alanmateuz/hacko-platform`. Este worktree está no branch `claude/hacko-landing`.

## Stack e infraestrutura

- **Aplicação:** vinext (Vite + app router estilo Next) rodando em **Cloudflare Workers**.
- **Banco de dados:** **D1** (SQLite), com migrações drizzle em `drizzle/0000–0009`.
- **Arquivos:** **R2**, binding `BUCKET`, bucket `hacko-files`.
- **Front:** SPA React em `app/hacko.tsx`, com rotas por hash (`#/event/id`, `#/manage/id`, `#/team/id`, `#/company`, `#/login`…).
- **API:** `app/api/hacko/route.ts` atende `GET ?action=` e `POST {op}`.
- **Autenticação:** `lib/auth.ts` e rotas em `app/api/auth/*`. Login por e-mail e senha (PBKDF2), Google em popup e GitHub; a sessão fica em cookie HttpOnly `hacko_session`.
- **Deploy:** `.github/workflows/deploy.yml`.
  - Cada PR roda testes e build.
  - O merge na `main` aplica as migrações D1 remotas e faz o `wrangler deploy`.
  - Secrets: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
- **Secrets do Worker:** `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET` e `RESEND_API_KEY` (e-mail de redefinição de senha).
- **Testes:** `pnpm test` (`tests/phase01.test.mjs`, que executa os handlers reais com node:sqlite) e `pnpm check` (tsc).
- **Ambiente local:** `pnpm dev` na porta 5173 (configuração `hacko-dev` em `.claude/launch.json`).
  - O primeiro carregamento demora.
  - Se `.vinext/dev/lock.json` travar a inicialização, apague o arquivo.

## Identidade visual

- **Cores:** azul `#0367FC`, verde-limão `#D2F801`, branco `#FFFFFF` e preto `#161616`. São variáveis CSS em `app/globals.css`: `--blue`, `--lime`, `--white`, `--ink`.
- **Marca:** wordmark `hacko↗` (componentes `Logo` e `Arrow`) e o padrão de setas ↗ limão / ↙ azul.
- **Tipografia:** Space Grotesk nos títulos e Manrope no texto.

## O que já está em produção (PRs mergeados)

- **Até o PR #15:**
  - domínio próprio e login por e-mail e senha, Google e GitHub, com medidor de força de senha;
  - páginas `/privacidade` e `/termos`;
  - recuperação de senha, exclusão de conta e logout;
  - contas de empresa, com perfil, painel do evento e a página Inscritos e equipes;
  - card "Sua equipe" e revisão das regras de equipe;
  - entregas com fotos, PDFs e links no R2, validadas pela empresa.
- **PR #16 — landing page em `/sobre`:**
  - feita a partir do design do Canva: `canva.link/s9sss72rnn238yo`, página 2, "pagina escolhida";
  - ação pública `GET /api/hacko?action=featured`: hackathons publicados cujo `ends_at` ainda não passou, até 12, com cache de 60 s;
  - carrossel com autoplay, que busca os eventos de novo a cada 5 min.

## Feito nesta etapa (ainda sem commit)

### Ajustes da landing, pedidos no PDF do usuário

- **Topo:** o botão branco "Contatos" e a listra verde do hero foram removidos.
- **Prints:** os "blocos" desenhados em CSS deram lugar aos **prints reais do Canva**.
  - Arquivos: `public/landing/explorar.png`, `comunidade.png` e `painel.png` (800 px de largura).
  - Os prints aparecem **cortados na borda** da seção, para dar profundidade (classes `.lp-shot.bleed-*`).
  - Ficam **inclinados em -2°** e com borda limão, como no Canva.
- **Anúncios e parceiros:** a seção foi removida.
- **Faixa preta de participantes:**
  - Ela agora termina exatamente na linha entre a imagem e o texto dos cards do carrossel.
  - Como funciona: o `ResizeObserver` do `Carousel` mede a imagem e ajusta `--cut` em `.lp-band`.
- **Sombra dos cards:** a sombra dos cards do carrossel foi removida.
- **Faixas de setas:** novo arquivo `public/landing/arrows.svg`.
  - São maiores e mais juntas, em duas linhas.
  - Aparecem no topo das Perguntas Frequentes e no rodapé de contatos.
  - **Animação:** passam na horizontal sem parar (`@keyframes lp-slide`).
- **Header:** os itens foram distribuídos pela largura (`.lp-nav-links`, `space-evenly`).
- **Espaçamentos:** revisados em múltiplos de 4 px, com colunas alinhadas no grid (container de 1184 px, gutter de 32 px, 16 px no mobile).
- **Animação de entrada:** os elementos com `data-reveal` sobem e aparecem ao rolar a página (hook `useReveal`). Tudo respeita `prefers-reduced-motion`.

### Popup de confirmação com o visual do hacko

- Os `confirm()` do navegador foram trocados pelo `ConfirmHost` e `askConfirm()` em `app/hacko.tsx`. O CSS `.confirm-*` está em `app/globals.css`.
- **Visual:** modal centralizado com fundo escurecido, borda limão, logo e os botões Cancelar e Confirmar. Esc ou um clique fora cancelam.
- **Onde aparece:** nos botões que pedem confirmação (`button(...)`, por exemplo confirmar a equipe) e ao remover um anexo da entrega.
- **Ainda não validado no navegador:** é preciso uma conta com equipe para disparar o popup.

### Favicon

- `public/favicon.svg` virou o quadrado limão `#D2F801` com cantos arredondados e a seta ↗ preta, conforme a imagem enviada.

## Decisões e motivos

- **Landing em `/sobre`, não em `/`:** a raiz continua sendo a plataforma (SPA com hash), para não quebrar links nem o login. A landing pode ir para `/` depois, se a plataforma mudar de caminho.
- **"Destaque" = hackathons ativos:** ainda não existe campo de destaque no banco. O carrossel mostra os eventos publicados ainda não encerrados e se atualiza sozinho com o que for publicado.
- **Planos, anúncios e FAQ com dados fictícios,** a pedido do usuário:
  - planos Básico (grátis), Médio (R$ 149) e Premium (R$ 399), marcados como "valores ilustrativos";
  - WhatsApp e Instagram (`@hacko`) ainda são placeholders.
- **E-mail de contato:** `suporte@hacko.com.br`. O Canva mostrava `hacko.br`, mas o domínio é `.com.br`.
- **Prints tirados do Canva:** o usuário pediu "os prints que enviei". A resolução é de 800 px; se ele exportar em tamanho maior, troque os arquivos em `public/landing/`.

## Arquivos importantes

| Arquivo | O que tem |
|---|---|
| `app/sobre/page.tsx`, `landing.tsx`, `landing.css` | Landing page |
| `public/landing/*` | Prints e padrão de setas da landing |
| `app/api/hacko/route.ts` | API; inclui a ação `featured` |
| `app/hacko.tsx` | App principal; inclui `ConfirmHost` e `askConfirm` |
| `app/globals.css` | Variáveis da marca e CSS do modal |
| `public/favicon.svg` | Ícone das abas |
| `lib/auth.ts`, `lib/deliveries.ts`, `db/schema.ts`, `drizzle/` | Autenticação, entregas e banco |
| `.github/workflows/deploy.yml` | CI e deploy |

## Estado atual

- **Branch:** `claude/hacko-landing`. Com o PR #16 já mergeado, há alterações **não commitadas** em:
  - `app/sobre/landing.css` e `landing.tsx`;
  - `app/hacko.tsx` e `app/globals.css`;
  - `public/favicon.svg` e `public/landing/`;
  - este `CONTEXTO.md`.
- **Validação:** `pnpm test` passa 11/11 e `pnpm check` não acusa erros.
- **Verificado no navegador:**
  - landing no desktop;
  - linha de corte do carrossel e faixa de setas do FAQ;
  - o print do topo, já com a inclinação;
  - no mobile, ausência de rolagem horizontal.
- **Ainda não verificado:**
  - o layout completo no mobile;
  - a faixa de setas do rodapé em screenshot (confirmada só pelo DOM);
  - o popup de confirmação;
  - o favicon no navegador.

## Próximos passos

1. O usuário ainda vai pedir mais mudanças na landing; aguardar.
2. Quando ele aprovar: criar um branch novo a partir da `origin/main` (por exemplo `claude/hacko-landing-v2`), commitar landing, popup e favicon e abrir o PR. O merge é feito pelo usuário e o deploy é automático.
3. Validar o popup de confirmação com uma conta que tenha equipe.
4. Opcional, se o usuário quiser:
   - criar um campo "destaque" nos eventos para escolher o que aparece no carrossel;
   - mover a landing para `/`;
   - trocar os placeholders de contato;
   - exportar os prints em resolução maior.
