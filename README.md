# Hacko — Fase 01

Código completo desta fase em `hacko-phase01-source.zip`. Extraia antes de executar os comandos abaixo. O pacote corresponde ao commit de hospedagem `3420c7ff290b396cc6f5cf8600809a124d7b98c3`. O conector GitHub não disponibiliza este repositório; o checkpoint foi enviado pela interface web. A sincronização dos arquivos individuais ainda depende de habilitar o acesso do conector ao repositório.


Núcleo funcional baseado no PRD v1.0 e na identidade visual do [Figma](https://www.figma.com/design/YWBXllkKdflwpesUc2kthv).

## Executar e verificar

Node >=22.13, pnpm 11.25.0. Instale com `pnpm install`, execute `pnpm test`, `pnpm check` e `pnpm build`. O ambiente de desenvolvimento segue os scripts de Sites/Vinext. Nunca injete identidade de teste em produção.

O frontend React usa rotas por hash e a API `/api/hacko`. O servidor usa Vinext/Cloudflare Workers, com banco D1. A plataforma fornece a identidade autenticada. `.openai/hosting.json` declara o banco; as migrações em `drizzle/` são aplicadas pela publicação Sites.

## O que funciona

- Acesso com ChatGPT; perfil de participante, visibilidade opt-in e links informados.
- Uma conta pode participar e administrar suas próprias organizações. A autorização é verificada no servidor, por organização e objeto.
- Eventos: rascunho, edição, publicação explícita, duplicação e arquivamento; regras, datas, vagas e limites de equipe.
- Catálogo pesquisável por nome/tema, cidade, modalidade e intervalo de datas.
- Inscrição com declaração de elegibilidade e aceite do regulamento; cancelamento até o início, após sair da equipe.
- Equipes: criação, busca, solicitações, convites entre inscritos, aceite/recusa, saída e dissolução pelo líder. Confirmação pelo organizador exige tamanho válido.
- Painel com inscrições, vagas, participantes sem equipe e histórico de ações.
- TeamMatch determinístico: preserva equipes existentes, agrupa por disponibilidade declarada e complementa competências. Propostas versionadas, revisão e aprovação explícita; mudanças invalidam propostas anteriores.
- Notificações internas e favoritos persistidos no servidor.
- Radar com OpenAI: interpretação de filtros do catálogo ou busca externa na web, com citações, fontes e data da consulta. Máximo de 20 buscas/dia por usuário; sem publicação automática.

## Configuração de IA

`OPENAI_API_KEY` deve existir somente como segredo do ambiente. Arquivos `.env*` estão ignorados pelo Git. A chave jamais é enviada ao frontend. O radar usa Responses API com `store:false`, limite de saída e timeout. A busca web pode ter cobrança própria e seus resultados precisam ser conferidos nas fontes oficiais. Falhas e falta de créditos são apresentadas ao usuário.

## Integridade e testes

`tests/phase01.test.mjs` executa o handler real da API com identidade simulada e adaptador D1 sobre SQLite em memória. Verifica autenticação, CSRF, isolamento de organizações, rascunhos ocultos, privacidade de e-mail/perfil, capacidade, inscrição idempotente, uma equipe por evento, tamanho mínimo/máximo, permissões do líder, cancelamento e rollback. Testa TeamMatch com 20/100/300 participantes, dados ausentes e limites diferentes, sem duplicidades ou omissões.

Restrições de inscrição e equipe também são impostas por índices únicos e verificações SQL dentro do mesmo batch transacional. A migração inicial foi corrigida após falhar antes da publicação; os guards SQL substituem triggers não aceitos pelo executor da hospedagem. Chamadas múltiplas usam batch transacional. Dados de teste não são inseridos em produção.

## Limites desta fase

- Login e recuperação usam a conta ChatGPT, sem senha própria da Hacko. A hospedagem permanece privada, conforme o acesso existente; convites de teste para outras pessoas exigem configurar acesso ao site.
- A conta proprietária administra a organização. Delegação a outros administradores, plataforma admin, LGPD/exportação/exclusão, moderação e e-mails transacionais ainda não estão implementados.
- TeamMatch permite revisar e aprovar, mas não editar individualmente a composição dentro da proposta. Para ajustes, use as equipes manuais e gere uma proposta nova.
- O radar é executado por consulta, sem rastreamento agendado, importação automática ou garantia de inscrições abertas.
- O copiloto de regulamento/agenda (P1), pagamentos, jurados e recrutamento ficam fora desta fase.
- Os três eventos fictícios da versão estática não são convertidos em registros reais. O catálogo começa vazio até uma organização publicar eventos.
- Não houve QA visual em navegador nesta execução: o ambiente não oferece o plugin control-browser exigido pelo fluxo de Sites. Build e testes de API não substituem teste com usuários reais.

## Identidade e créditos

Azul #0367FC, azul de ação #0057D9, lima #D2F801 e carvão #161616. Space Grotesk e Manrope continuam substitutas provisórias de Clash Display e Gilroy. Layout responsivo, foco visível, rótulos de campos e estados de erro/carregamento.

Fotos ilustrativas com licença Unsplash (não domínio público): George Dagerotip https://unsplash.com/photos/gQxpuAU6mLU; Jj Englert https://unsplash.com/photos/H2pfrqhQou8; Creatopy https://unsplash.com/photos/M35xxKGb_tA.
