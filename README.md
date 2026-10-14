# Hacko · v0.2

Primeira implementação responsiva do design system Hacko: descoberta de hackathons, detalhes, comunidade, equipes, perfil e fluxo de acesso.

## Executar

Requer Node.js 18+ para os testes e Python 3 para o servidor de desenvolvimento.

```sh
npm test
npm run check
npm start
```

Abra http://localhost:8080. Não há dependências de build. `dist/` contém o aplicativo modular em HTML, CSS e JavaScript, pronto para hospedagem estática. As rotas usam fragmentos (#/) para funcionar sem regras no servidor.

## Design

Figma: https://www.figma.com/design/YWBXllkKdflwpesUc2kthv
Página: 04 · Hacko v0.2 — Descoberta e comunidade.
Home 26:2; detalhe 26:114; perfil 27:85; radar 27:162; comunidade 27:239; login 31:247; mobile 32:310.

Tokens: azul #0367FC, ação #0057D9 para contraste de texto, lima #D2F801, carvão #161616, branco #FFFFFF. Space Grotesk e Manrope são substitutas provisórias de Clash Display e Gilroy. CSS responsivo, foco visível, navegação por teclado, labels, mensagens aria-live e respeito a movimento reduzido.

## Escopo e limites

- Filtros combinados por busca, região e categoria; detalhes próprios para três eventos.
- Favoritos, perfil, grupos e equipe persistidos no localStorage, apenas neste navegador.
- Login/cadastro/recuperação são demonstrações sinalizadas. Senhas não são armazenadas nem enviadas; use dados fictícios.
- Radar não chama IA nem busca na web: filtra o catálogo de exemplo.
- Não existe backend, banco de dados, autorização entre usuários, convite real ou envio de e-mail. Antes de produção: autenticação e regras de acesso no servidor, catálogo verificado, moderação, validação no servidor e integrações de notificações.
- Eventos, datas, locais, prêmios e contagens fictícios. Mapa ilustrativo.
- Testes automatizados verificam filtros, escaping e integridade das rotas. Revisão visual em navegador não realizada neste ambiente.

## Fotos

Fotos ilustrativas sob licença Unsplash (https://unsplash.com/license), não domínio público:

1. George Dagerotip — https://unsplash.com/photos/gQxpuAU6mLU
2. Jj Englert — https://unsplash.com/photos/H2pfrqhQou8
3. Creatopy — https://unsplash.com/photos/M35xxKGb_tA

Fontes carregadas do Google Fonts com fallback local sans-serif.

## Organização

- dist/index.html: documento e acessibilidade inicial.
- dist/styles.css: tokens, componentes e breakpoints.
- dist/data.js: catálogo, filtros e escaping.
- dist/app.js: rotas, componentes e interações.
- tests/data.test.js: testes de comportamento e proteção de conteúdo.

## Próximos marcos

1. Backend com autenticação real e dados por usuário.
2. Gestão de hackathons e equipes para organizadores.
3. Coleta verificável de oportunidades, deduplicação, origem e data de atualização.
4. QA de navegador e dispositivos, auditoria de acessibilidade e testes de integração.
