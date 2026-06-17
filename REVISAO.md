# Revisão de código — correções e melhorias

Auditoria de consistência entre as camadas (o maior risco num monorepo construído em fases),
priorizando incompatibilidades de contrato que o `ValidationPipe` com `forbidNonWhitelisted: true`
transformaria em erro 400 em runtime.

## Bugs corrigidos
1. **Endereços — `uf` vs `estado` (P0 de runtime).** O painel enviava `uf`, mas o model e o DTO usam
   `estado`. Com `forbidNonWhitelisted`, *todo* salvamento de endereço retornaria 400, e a UF nunca era
   exibida. Corrigido no web para usar `estado` (envio, edição e listagem).
2. **Webhook Mercado Pago — extração do `data.id`.** `@Query('data.id')` não captura o parâmetro porque o
   Express (qs) aninha `data.id` em `query.data.id`. Trocado por leitura robusta do objeto de query, com o
   corpo (`body.data.id`) como fonte primária. Caminho P0 (confirmação de pagamento) agora confiável.
3. **Impressão térmica (mobile) — `btoa`/spread.** `globalThis.btoa(String.fromCharCode(...bytes))` quebra
   no React Native (sem `btoa`) e pode estourar a pilha. Substituído por um encoder base64 próprio, por
   chunks — **validado contra o `Buffer` do Node (57/57 casos, com padding)**.

## Robustez
4. **`formatarBRL(null/undefined)`** retornava exceção (`new Decimal(undefined)`); agora trata como `0`,
   evitando tela branca caso algum campo monetário falte.

## Performance
5. **Mapa de clientes — N+1.** A página buscava os endereços de cada cliente num laço. Novo endpoint
   `GET /clientes/mapa` resolve numa única query, **escopado por rota no servidor** (anti-IDOR), e o web
   passou a consumi-lo.

## Conferências sem alteração (contratos OK)
- `POST /cobrancas`, criação/finalização de locações, CRUD de clientes/usuários/auxiliares, atribuição de
  permissões e o catálogo: payloads do painel batem com os DTOs e com o retorno dos serviços.
- Relações percorridas por relatórios e notificações existem no schema; `SaldoService`/`RedisService`
  expõem os métodos usados; enums (`FormaPagamento`, `AlvoPagamento`, `StatusPagamento`) cobrem os valores.

## Verificação pós-revisão (harnesses)
Integração API 15/15 · cliente de sync 7/7 · cripto/webhook 9/9 · recibo ESC/POS 7/7 · base64 57/57.

## Rodada 2 — correções e melhorias

6. **Endereço cadastrado no cliente.** O `CriarClienteDto` passou a aceitar um `endereco` embutido e o
   `ClientesService.criar` cria cliente + endereço **na mesma transação** (nested create). No painel, o
   endereço entra no formulário do cliente: inline na criação e gerenciável na edição
   (`GerenciadorEnderecos`, múltiplos endereços por cliente). Seção avulsa "Endereços" removida do menu.
7. **Mensagens de erro de validação.** O NestJS devolve `message` como array nas falhas de validação; os
   clientes de API (web e mobile) agora juntam o array numa frase legível em vez de exibir `[object]`.
8. **Mobile — erro de API.** O cliente mobile passou a extrair a mensagem do servidor (antes só mostrava o
   status), facilitando o diagnóstico de falhas de sync.
9. **Locações — relocação.** A finalização por relocação trocou o campo "ID do endereço" (UUID digitado)
   por um **seletor dos endereços do novo cliente**.
10. **Produtos — CRUD no painel.** A tela, antes só de leitura, ganhou cadastro/edição (plaqueta, tipo,
    tamanho, condição, descrição/cor, chave) e **ajuste de contador** (endpoint dedicado), respeitando as
    permissões `produtos.*`.

Consistência verificada: o mobile usa `estado` (não `uf`) e não cria clientes/endereços em campo, então a
mudança de endereço-no-cliente não o afeta.

## Rodada 3 — criação offline no mobile (lacuna corrigida)

Faltava no app a criação em campo de **cliente (com endereço), produto e locação** — só havia
cobrança/pagamento/manutenção. As tabelas locais já existiam e o servidor já aceitava essas entidades no
push; completei a ponta do cliente:

11. **Repositórios locais** `criarClienteComEndereco` (transação cliente+endereço), `adicionarEndereco`,
    `criarProduto`, `criarLocacao` (com checagem local de "produto já tem locação ativa"; a trava forte é o
    índice único no servidor). Tudo gravado como `_syncStatus='created'` para subir no próximo push.
    Alinhamento coluna×placeholder×parâmetro dos INSERTs verificado.
12. **Telas** `NovoCliente` (com captura de GPS via expo-location), `NovoProduto` e `NovaLocacao`, com um
    seletor (`Selecao`) reutilizável. Pontos de entrada: botões "Novo cliente"/"Novo produto" na lista de
    clientes e "Nova locação" na tela do cliente; as listas recarregam ao voltar (evento de foco).
13. **Sync conferido**: `produto→cliente→endereço→locação` já estão na ordem de dependência do push, são
    `pushable`, e o `paraServidor` converte `telefones` (JSON→array) e booleanos; o servidor sanitiza pelo
    allowlist (inclui esses campos; `saldoDevedorAtual` fica de fora, pois é derivado).

Observação: o saldo da locação criada em campo entra como `0` e é **derivado pelo servidor** a partir do
histórico — o app nunca o envia como verdade.

## Rodada 4 — telas de edição no mobile

Complemento à criação em campo: edição offline de **cliente (+ endereços), produto e locação**.

14. **Repositórios** `obter*` e `atualizar*` (cliente, produto, locação, endereço) + `removerEndereco`
    (tombstone, ou apagar local se ainda era `created`). Regra de sync na edição: registro `created`
    permanece `created` (sobe como create único com os dados finais); `synced` vira `updated`. **A `version`
    não é incrementada localmente** — enviamos a última versão conhecida e o servidor resolve conflito e
    devolve o estado correto no pull (push→pull no mesmo ciclo). Mudança de regra/valores na locação
    incrementa `regraVersao` (as cobranças passam a fotografar a nova versão).
15. **Telas** `EditarCliente` (campos + `GerenciadorEnderecosMobile`: adicionar/editar/remover endereços com
    GPS), `EditarProduto`, `EditarLocacao`, e uma `Produtos` (listagem) para chegar à edição de produto.
    Entradas: "Editar cliente / endereços" na tela do cliente, "Editar locação" em cada card de locação,
    "Produtos" na barra da lista de clientes. Todas as listas recarregam no foco.
16. **Verificação**: alinhamento placeholder×parâmetro de **todos** os 11 comandos SQL (6 INSERT + 5 UPDATE)
    conferido por checador com casamento de colchetes balanceado.

## Rodada 5 — overhaul visual do mobile (inspirado no app de referência)

A partir de um app anterior que o usuário considerou "bonito e fluido", adotei o que dava cara de app,
mantendo a identidade do domínio (verde feltro + latão):

17. **Tema central** (`ui/tema.ts`): paleta (primária feltro, acento latão, neutros slate, status), espaços,
    raios, sombra e tipografia — trocar a paleta num só lugar reflete em tudo (ideia do `branding.ts` deles).
18. **Kit de componentes** (`ui/componentes/kit.tsx`): `IconeChip`, `Cartao`, `StatusBadge` (pílula suave),
    `MetricCard`, `QuickAction`, `EmptyState`, `CabecalhoSecao`, `BotaoPrimario` — com `@expo/vector-icons`.
19. **Navegação por abas** (`@react-navigation/bottom-tabs`): Início · Rotas · Produtos · Mais, com stacks
    por seção e formulários/edição em apresentação **modal**; cabeçalhos no verde da marca; `SafeAreaProvider`.
20. **Dashboard (Início)**: saudação, aviso de pendências de sync (toque para sincronizar), `MetricCard`s
    (cobranças hoje, clientes com saldo, locações ativas, produtos) e ações rápidas — contagens via
    `resumoDashboard()` no banco local.
21. **Listas restilizadas** (Rotas, Clientes, Produtos): cartões com chip de ícone, busca, estados vazios
    amigáveis e badges de status (ex.: "Saldo devedor" / "Em dia").

Deps adicionadas: `@expo/vector-icons`, `@react-navigation/bottom-tabs`, `react-native-safe-area-context`.

### Rodada 5 (cont.) — restyle das telas restantes
- Login com identidade da marca; campos padronizados (`CampoTexto`) e seções em cartão (`Secao`) em todos os
  formulários (Novo/Editar de cliente, produto, locação) e no registro de cobrança (resultado em cartão com
  memorial e badge "Registrado"); seletor (`Selecao`) em bottom-sheet alinhado ao tema; detalhe do cliente e
  manutenções em cartões com chips de ícone e estados vazios. Cor primária mantida no **verde feltro**.

## Rodada 6 — telas portadas do app de referência

Portei do app anterior as telas que preenchem lacunas reais e são seguras no offline-first
(append-only ou somente leitura — sem depender de lógica server-side que o push não dispara):

22. **Quitação de saldo devedor** (`QuitacaoSaldoScreen`): registra pagamento contra um `SaldoDevedorLocacao`
    (append-only, FK `saldoId` — consistente entre mobile/servidor/allowlist). `valorRestante`/`status` são
    **derivados pelo servidor**; localmente atualizo só para feedback imediato, sem marcar o saldo como dirty
    (o pull reconcilia). Entrada: botão "Quitar saldo" no card de saldo do cliente.
23. **Histórico de cobranças** (`HistoricoCobrancasScreen`) + **detalhe** (`CobrancaDetailScreen`): leitura das
    cobranças do cliente (com badge de status) e o detalhe com valores e pagamentos. Entrada: ícone de recibo
    no topo da tela do cliente.
24. **Relatório de cobranças** (`RelatorioCobrancasScreen`): totais locais do dia/mês (quantidade, recebido,
    recebido por forma). Entrada: item no menu "Mais".

Não portei *finalizar locação / enviar para estoque* nem *confirmação de PIX*: dependem de efeitos server-side
(derivar saldo na finalização, baixa de PIX) que o push de sync não dispara — ficam como ação online dedicada.

Verificação: 13/13 comandos SQL alinhados (placeholder×parâmetro); harness da lógica de quitação 5/5 e do
relatório OK.

## Rodada 7 — finalização de locação OFFLINE (re-locação do mesmo produto em campo)

Cenário de campo: sem internet, finalizar a locação atual, cadastrar novo cliente e criar nova locação do
**mesmo produto**. Antes isso travava (produto preso a uma locação ATIVA). Tornado possível e seguro:

25. **Mobile `finalizarLocacao`**: em transação, se há saldo grava `SaldoDevedorLocacao` ('created',
    `valorOriginal` = saldo — o servidor deriva `valorRestante`/`status`) e encerra a locação
    (`status='FINALIZADA'`, `finalizacaoTipo`, `depositoId`, `dataFim`). Isso **libera o produto** (deixa de
    ser ATIVA), então `criarLocacao`/`produtosDisponiveis` já permitem nova locação do mesmo produto offline.
    Tela `FinalizarLocacaoScreen` (destino Depósito/Relocação) e ação "Finalizar" no card da locação.
26. **Servidor (sync push)** — fechou a lacuna de integridade que existia para locações vindas do campo:
    - **Deriva `chaveProdutoAtivo`** a partir do status (ATIVA → produtoId; FINALIZADA/excluída → null). Essa
      coluna `@unique` é a trava "1 ativo por produto" e não trafega no allowlist, então o sync passa a geri-la.
    - **Aplica finalizações/exclusões antes das ativações** dentro do lote de `locacao`, liberando a chave
      antes que a nova locação do mesmo produto a reivindique (senão o índice único dispararia na transação).
    - **Inicializa `valorRestante` = `valorOriginal`** ao inserir um `SaldoDevedorLocacao` (campo obrigatório,
      fora do allowlist) e marca o saldo para recálculo (deriva o restante/quitação pelos pagamentos).

Verificação (harness): 15/15 comandos SQL alinhados; lógica do servidor 4/4 — (A) finalizar+relocar o mesmo
produto funciona com a ordenação; (B) sem ordenar violaria (prova a necessidade); (C) duas ATIVAS no mesmo
produto seguem bloqueadas (proteção intacta); (D) finalizar libera o produto; saldo novo inicia
`valorRestante=valorOriginal` / PENDENTE.

## Rodada 8 — lista de cobrança consolidada (mobile)

27. **`clientesParaCobrar()`** + **`ListaCobrancaScreen`**: visão única dos clientes com algo a cobrar,
    somando locações ATIVAS com saldo (> 0) e saldos devedores PENDENTES (> 0) de locações finalizadas;
    cabeçalho com total geral e contagem, itens ordenados pelo maior valor, toque abre o detalhe do cliente.
    Entradas: card "Cobranças pendentes" no topo de Rotas, e na Home (métrica "Clientes com saldo" e ação
    rápida "Cobrar"). Apenas leitura/offline; valores exatos por item permanecem no detalhe do cliente.
    Harness de agregação OK (só positivos, locação finalizada não soma `saldoDevedorAtual`, ordem desc).

## Rodada 9 — lista de cobrança: agrupar por rota + atraso

28. **`clientesParaCobrar()`** passou a trazer `rotaNome` e `ultimaCobranca` (MAX(dataCobranca) do cliente).
    **`ListaCobrancaScreen`** virou `SectionList` **agrupada por rota** (rotas ordenadas por nome, com
    subtotal por rota) e ganhou **badge de atraso** por cliente: "há Xd" desde a última cobrança, sinalizado
    em vermelho quando passa de 30 dias ou quando nunca houve cobrança ("Nunca cobrado"). Mantém total geral.
    Harness OK (ordenação das seções, subtotais e regra de atraso).

## Rodada 10 — cobrança rápida + limite de atraso configurável

29. **Atalho "Cobrar agora"** na lista de cobrança: botão por cliente que resolve no toque —
    `locacoesParaCobrarDoCliente()` → se há **exatamente uma** locação ativa com saldo, vai direto à tela de
    cobrança daquela locação; com mais de uma (ou só saldo devedor), abre o detalhe do cliente para escolher.
    O toque na linha continua abrindo o detalhe.
30. **Limite de atraso configurável**: `obterDiasAtraso()`/`definirDiasAtraso()` (em `sync_meta`, padrão 30,
    valores inválidos caem no padrão) + **`ConfiguracoesScreen`** (campo + presets 7/15/30/60), acessível pelo
    menu "Mais". A `ListaCobrancaScreen` passou a usar esse limite para o badge de atraso.
    Harness OK (roteamento do atalho 3/3; parse da configuração 7/7).

## Rodada 11 — revisão de código e ajustes de engenharia

Varredura sistemática do mobile + correções de higiene:
31. **Imports hoisted**: `uuid` e `somar` movidos para o topo de `repositorios.ts`; `TextInput` consolidado no
    import de topo do `kit.tsx` (eliminando imports no meio do arquivo — regra `import/first`). Removido
    `Ionicons` órfão em `HistoricoCobrancasScreen`.
32. **`MapaLeaflet` reaproveitado** (estava órfão): restilizado ao tema (container arredondado, botão de GPS,
    legenda de coordenadas) e **integrado** ao cadastro (`NovoClienteScreen`) e à edição de endereços
    (`GerenciadorEnderecosMobile`) — toque/arraste do pino + GPS, substituindo o botão "cego". Removidos
    `expo-location`/`capturarGps`/`gps` redundantes nessas telas (o mapa cuida do GPS).
    *Limitação conhecida:* WebView dentro de ScrollView pode disputar o gesto de arrastar o mapa em alguns
    aparelhos; toque para posicionar e arrastar o pino funcionam normalmente.

Verificações automatizadas nesta rodada (harness/scan):
- Imports: nenhum componente RN usado sem import; sem imports duplicados; sem `Ionicons`/`Location` órfãos.
- Navegação: todos os alvos (`navigate`/`screen`/`reset`) existem entre as telas registradas; 22/22 telas
  registradas no `App.tsx`.
- SQL: 15/15 comandos (placeholder×parâmetro) alinhados em `repositorios.ts`.
- Consistência de domínio: `abasDoCliente` retorna `l.*` (cobre os campos que `registrarCobrancaLocal` usa);
  colunas de `cobranca` cobrem o detalhe; push é genérico (servidor filtra pelo allowlist); `produtosDisponiveis`
  reabilita o produto após finalização (re-locação offline OK).

## Rodada 12 — revisão profunda (pull, allowlist, consistência)

Foco em pontos não cobertos antes:
33. **Simetria pull/push**: o upsert do pull é genérico (`colunasDe` filtra pelas colunas reais da tabela,
    converte bool/JSON, marca `synced`) — logo o pull regrava `valorRestante`/`status` derivados dos saldos e
    os campos de finalização, e a tabela local `locacao` já possui todas essas colunas
    (`status/dataFim/finalizacaoTipo/depositoId`). Tombstones do pull apagam a linha local.
34. **Diff colunas do mobile × allowlist do servidor** (script): nenhum dado real é descartado por nome
    divergente. Os únicos descartes são **corretos por design** — `relocadaParaId`/`estornadoPorId` (operações
    de servidor, sem coluna local) e `usuario.nome/cpf/deletedAt` (a trava de segurança: o app só atualiza
    `pushToken`; identidade do usuário é autoridade do servidor).
35. **Consistência do sinal de saldo**: alinhado o "cliente nos deve" para `> 0` em todos os lugares — badge da
    lista de clientes (`clientesDaRota.temSaldo`) e métrica da Home (`resumoDashboard`) antes usavam `<> 0`
    (incluíam saldo negativo, em que nós devemos ao cliente), divergindo da lista de cobrança/detalhe que usam
    `> 0`. Agora todos batem.
36. **Harness permanente** `packages/api/test/finalizacao-harness.js` (7/7): cobre derivação de
    `chaveProdutoAtivo`, ordenação finalizar-antes-de-ativar, liberação por finalização/exclusão e init de
    `valorRestante`. **Adicionado ao CI**.

Estado dos testes: núcleo (cálculo/calendário/sync/saldo), integração 15/15, sync mobile 7/7, finalização 7/7,
SQL 15/15. Pendências para ambiente com rede: `tsc --noEmit` + ESLint no monorepo e e2e dos fluxos novos.

## Rodada 13 — proteção contra duplo-toque (integridade de gravação)

37. **Confirmação de envio do pull**: confirmado que o servidor faz `findMany` sem `select` (exceto `usuario`),
    portanto o pull **envia** `valorRestante`/`status` derivados; com o upsert genérico do mobile, a
    convergência do saldo após quitação/finalização fica garantida.
38. **Guarda anti-duplo-toque** nas telas que INSEREM (risco de cobrança/pagamento/cadastro em duplicidade):
    `BotaoPrimario` ganhou estado `carregando` (desabilita o toque + spinner). Aplicado em **RegistrarCobranca**
    (além de esconder o botão após registrar — impede recobrança na mesma tela), **QuitacaoSaldo**,
    **NovaLocacao**, **NovoProduto**, **NovoCliente** e **FinalizarLocacao** (guarda no confirm do alerta).
    Edições (idempotentes) e Login (já tratado) não precisaram.

## Rodada 14 — robustez de boot e de runtime

39. **Corrida de inicialização do banco (corrigida)** — `obterDb` memorizava o *objeto* do banco e o atribuía
    logo após `openDatabaseAsync`, antes de criar o schema. No boot há vários chamadores concorrentes
    (`index.ts`, background sync, telas montando); um deles podia obter o banco **antes do schema existir**
    ("no such table"). Passou a memorizar a *promessa* de init (abrir→PRAGMA→schema), com reset em falha para
    permitir nova tentativa. Todos os chamadores aguardam o mesmo init.
40. **ErrorBoundary** no topo da navegação — captura erros de render/lifecycle e mostra tela amigável
    ("Tentar novamente") em vez de derrubar o app; dados locais intactos.

Verificações positivas desta rodada (sem necessidade de mudança): cliente HTTP já faz refresh de token no 401
com retry único; `colunasDe` já tem cache por tabela; `API_BASE_URL` é baseado em env (sem hardcode de prod);
pull do servidor envia campos derivados; background sync trata erro e checa status antes de registrar.

## Rodada 15 — revisão do painel web

41. **Refresh de token no web (bug corrigido)** — o access token expira em ~15 min e o web **guardava** o
    refresh token, mas o cliente de API **não o usava**: no 401 deslogava direto, jogando o usuário para o
    login a cada ~15 min de uso. Implementado `tentarRefresh()` + retry único em `req()` e em `baixar()`
    (downloads de relatório também sofriam); só desloga (limpando token/refresh/usuario) se o refresh falhar.
    Espelha o comportamento já existente no mobile.

Verificações positivas no web (sem mudança): guarda de auth no layout do painel (redireciona se não logado);
`GerenciadorEnderecos` envia `estado` (o bug `uf` continua corrigido); `NEXT_PUBLIC_API_URL` por env; tratamento
de `message` string/array do NestJS.

## Rodada 16 — índices locais (SQLite) para as features novas

42. **Servidor (Postgres)**: confirmado bem indexado — `@@index([updatedAt])` em todos os modelos (essencial
    pro sync incremental), FKs indexados e composto `[locacaoId, dataCobranca]`. O item "índices faltando" do
    audit está resolvido no servidor.
43. **Mobile (SQLite) — índices adicionados**: as features recentes varriam tabelas sem índice. Incluídos
    (migração aditiva, `CREATE INDEX IF NOT EXISTS`, aplicada no boot):
    - `idx_saldo_cliente` em `saldo_devedor_locacao(clienteId, status)` — lista de cobrança, abas do cliente, dashboard;
    - `idx_pagamento_saldo` em `pagamento(saldoId)` — soma de pagamentos na quitação;
    - `idx_pagamento_cobranca` em `pagamento(cobrancaId)` — detalhe da cobrança;
    - `idx_locacao_produto` em `locacao(produtoId, status)` — checagem "produto ativo único"/disponíveis;
    - `idx_manutencao_produto` em `manutencao(produtoId)` — filtro de manutenções.
    Antes dessas consultas faziam full scan local; agora usam índice.

## Rodada 17 — preparação para o agente de testes

44. **`HANDOFF-TESTES.md`** (raiz): ordem de build, pré-requisitos (Node 20; **sem `package-lock.json` → usar
    `npm install`**, não `npm ci`), verificações estáticas a rodar (`tsc`/ESLint, nunca executados aqui),
    testes sem infra (harnesses + jest do núcleo), e2e com Postgres/Redis, áreas de foco e lacunas conhecidas.
45. **`docker-compose.test.yml`** criado — o `TESTES.md` o referenciava mas não existia (Postgres:5433/Redis:6380).
46. **CI e2e corrigido (bug real)**: o passo usava `prisma migrate deploy`, mas **não há migrations** no repo —
    não criava tabela alguma e o e2e falharia. Trocado por `prisma db push` (no CI e no handoff). Anotado nas
    lacunas que produção deve usar migrations versionadas.

## Rodada 18 — correções do relatório de verificações do agente de testes

Aplicadas as correções do PDF de verificações (TS/ESLint/Prisma/deps). Detalhe item-a-item em
`CORRECOES-RELATORIO.md`. Resumo:
- **P0**: enums Prisma reformatados (um valor/linha); `Frequencia` deixou de ter export duplicado no core;
  `thermal-receipt-printer` → `^1.1.5`; CI passou a `npm install` (sem lockfile ainda).
- **P1**: a maioria dos 54 erros da API era **cascata do Prisma não-gerado** (schema inválido) — corrigido o
  schema, `prisma generate` restitui os tipos. Anotados `tx: Prisma.TransactionClient` em 5 services;
  supertest com import default; `@types/react` unificado via `overrides`; `expo-sqlite/next` (API async no SDK
  50); `Buffer.from()` na exportação; `as jwt.SignOptions`; ESLint configurado (raiz + web) com devDeps.
- **P2**: `@types/uuid`, `module:esnext` no tsconfig mobile, e itens documentados/pendentes (e2e dos fluxos
  novos, testes UI, migrations, npm audit).
- **Nota**: o relatório apontou o harness de finalização e o refresh de token no web como ausentes, mas ambos
  já estavam no código — a verificação rodou sobre um pacote anterior. Re-rodar sobre o zip atual.

## Rodada 18-final — 6 erros residuais do re-teste

47. **Campo `version` ausente no modelo `Cliente`** (5 erros TS2353/TS2339 na API): o DTO e o
    `clientes.service.ts` usam `version` para concorrência otimista (`where { id, version }`,
    `data { version: { increment: 1 } }`), e o `sync.e2e-spec` lê `cli.version`, mas o model não tinha o
    campo. Adicionado `version Int @default(0)` ao `Cliente` (a tabela local mobile e o allowlist já tinham
    `version` — agora tudo alinhado). Resolve os 5 de uma vez após `prisma generate`.
48. **`catch` sem tipo no web** (1 erro TS7006): `relatorios/page.tsx` linha 26 — `.catch((e) => …)` →
    `(e: any)`.
49. **Warning do core**: removido import não usado `dinheiro` em `calculo.ts`.

## Rodada 18-final-2 — último bloqueio do web + limpeza de warnings

50. **3 `@ts-expect-error` obsoletas no web** (TS2578): em `MapaClientes.tsx` as diretivas suprimiam o
    mismatch de `@types/react` que o `override` (r18) eliminou — ficaram sem uso e viraram erro. Removidas as
    3 linhas (o JSX segue íntegro). Com isso o web compila limpo → **4/4 workspaces**.
51. **Warnings da API zerados**: removido `estrategia` morto (e o import órfão `ESTRATEGIA_POR_ENTIDADE`) em
    `sync.service.ts`; removidos `IsNumber`/`Min` não usados em `finalizar-locacao.dto.ts`; e
    `ignoreRestSiblings: true` no ESLint para o padrão de omissão `const { version, updatedAt, ...resto }`.
52. **Web**: restam 7 warnings `react-hooks/exhaustive-deps` (não-bloqueantes) — deixados como estão
    (adicionar deps cegamente pode mudar comportamento; revisar caso a caso numa rodada de qualidade).

## Rodada final-2 — último erro mascarado + critical do next

53. **`baixar()` sem tipo de retorno** (TS7023 em `web/src/lib/api.ts:55`): função recursiva (retry após
    refresh) cujo único `return` é a própria chamada → o TS não consegue ancorar o tipo. Anotado
    `: Promise<void>`. (O `req()` é recursivo também, mas tem retorno concreto na linha 46, então não
    precisa.) Com isso o web fecha → **4/4 workspaces limpos**.
54. **Critical do `npm audit`**: era o `next@14.2.5` (GHSA-f82v-jwr5-mffw, bypass de middleware, CVSS 9.1) —
    e a maioria das 18 high também. Bump non-breaking `next` → `^14.2.35` (mesma minor) +
    `eslint-config-next` alinhado. Resolve a critical e as high do next de uma vez.

## Rodada final-3 — prerender SSR das páginas de erro (efeito do bump do next)

55. **`next build` falhava no prerender de /404 e /500** (`useContext` null em SSR) — efeito colateral do bump
    14.2.5→14.2.35, que passou a prerenderizar as páginas de erro; como o `layout.tsx` raiz envolve tudo no
    `AuthProvider` (que usa `useRouter`/`useContext`), o build quebrava. **Não é erro de tipo nem regressão de
    código.** Como o painel é 100% autenticado (sem ganho em prerender estático), adicionei
    `export const dynamic = 'force-dynamic'` no layout raiz — desativa o prerender estático e resolve o build.
    Alternativas consideradas (AuthProvider tolerante a SSR / mover provider para o grupo (painel)) ficam como
    refino futuro caso se queira voltar a ter páginas estáticas.

## Rodada final-4 — prerender /404,/500: correção de raiz (provider fora do layout raiz)

56. O `force-dynamic` (final-3) **não resolveu** — o crash de `useContext` no prerender de /404 e /500 vinha de
    o `AuthProvider` (cliente) estar montado no **layout raiz**, que envolve até as páginas de erro. Correção de
    raiz (sem `force-dynamic`, removido):
    - `app/layout.tsx` agora é **mínimo** (`<html><body>`), sem `Providers`;
    - `app/login/layout.tsx` (novo) e `app/(painel)/layout.tsx` montam `<Providers>` só nas suas subárvores;
    - a lógica de guarda do painel saiu para `components/PainelGuard.tsx` (cliente), permitindo que o layout do
      painel seja server component que monta o provider acima do consumidor (e já corrige 1 warning de
      `exhaustive-deps`, incluindo `router` nas deps).
    Resultado: /404, /500 e / (redirect) renderizam sem `AuthProvider` → sem crash no prerender; login e painel
    seguem com o contexto. `app/page.tsx` (redirect) não usa contexto.

## Rodada final-5 — causa raiz REAL do prerender: duas instâncias de React

57. **Dual React (a causa de verdade)**: o agente provou — havia `react@18.2.0` (hoisted na raiz, puxado por
    deps do mobile/expo) e `react@18.3.1` (declarado no web). O `overrides` cobria só `@types/react`, não o
    `react`/`react-dom`. No prerender de /404 e /500, o `react-dom-server` da raiz e o `react` da cópia do web
    eram instâncias diferentes → `ReactCurrentDispatcher.current` null → `useContext` null (o `next/head`
    interno também usa `useContext`, por isso persistia mesmo sem o `AuthProvider`). **Correção provada pelo
    agente**: adicionar `react`/`react-dom` ao `overrides` da raiz (`18.3.1`) → build passou 20/20. Aplicado.
    A reestruturação do final-4 (provider fora do layout raiz) foi mantida — é arquiteturalmente correta.
58. **2 erros de ESLint no mobile** (`@ts-ignore` em `impressao.ts:37,39`): em vez de trocar por
    `@ts-expect-error` (risco de TS2578, pois `BLEPrinter` vem de import sem tipos = `any`), configurei
    `ban-ts-comment` para `allow-with-description` — os dois `@ts-ignore` têm descrição, então passam; os sem
    descrição continuam banidos.

## Rodada final-5+e2e — specs e2e dos fluxos novos

59. **`packages/api/test/fluxos-novos.e2e-spec.ts`** (novo) — cobre os fluxos que só tinham harness de lógica:
    - **Relocação do mesmo produto numa chamada** (`POST /locacoes/:id/finalizar { tipo: 'RELOCACAO',
      novaLocacao }`): finaliza a antiga (`status FINALIZADA`, `chaveProdutoAtivo` null, `relocadaParaId` →
      nova), cria a nova ATIVA no mesmo produto herdando regra/valor com `contadorInicial` = contador atual,
      preserva o saldo como `SaldoDevedorLocacao` PENDENTE, e mantém exatamente 1 ativa por produto
      (índice único). Também: depósito libera o produto; 2ª locação direta → 409; relocação sem dados → 400.
    - **Quitação de saldo** (`POST /saldo-devedor/:id/pagar`): parcial mantém PENDENTE; total → QUITADO;
      já quitado → 400; idempotência por `pagamentoId` (não desconta 2×).
    - **Lista de cobrança** (`GET /saldo-devedor?clienteId=`): lista pendentes (>0) e esvazia ao quitar.
    Segue o padrão dos specs existentes (utils `criarApp`/`limparBanco`/`seedBasico`/`login`, `import request`).
    Roda junto com auth/cobrancas/sync via `npm -w @app/api run test:e2e` (precisa do Postgres+Redis).

## Rodada e2e real (Postgres+Redis) — 20/20 verde + 3 bugs corrigidos

60. **e2e executados de verdade**: 4 suites, 20 testes, **20/20 verde** (fluxos-novos 8/8, cobrancas, sync, auth).
    Rodar contra infra real revelou 3 problemas que nenhuma verificação estática pegaria:
    - **[BUG DE PRODUÇÃO] `AuditoriaService.sanitizar`** passava `Decimal`/`Date` crus pro `logAuditoria.create`,
      quebrando com `PrismaClientValidationError: [object Function]`. Corrigido: `Date`→ISO, objetos não-simples
      (Decimal: prototype ≠ Object.prototype)→`String()`, recursão só em objetos planos; mantém a redação de
      `CAMPOS_SENSIVEIS` (inclusive aninhada/em arrays). Verificado por mini-harness 12/12.
    - **[TESTE] rate-limit acumulando no Redis entre suites** (`--runInBand`) derrubava o último suite com 401.
      `RedisService.limparTudo()` (flushall) + `limparBanco(prisma, app?)` dá flush quando recebe o app; os 4
      specs passam `app`.
    - **[TESTE] `jest-e2e.json` moduleNameMapper** apontava `../core/src` (inexistente) → corrigido para
      `../../core/src/index.ts`.
61. **`packages/api/test/auditoria-harness.js`** (novo, 13 verificações) espelha o `sanitizar` e entra no CI
    (junto de integração/finalização/sync) — move a detecção desse bug de "precisa de Docker" para "roda no CI".

## Rodada migrations — saída do db push para histórico versionado

62. **Migration inicial `0_init`** (`packages/database/prisma/migrations/0_init/migration.sql`) escrita a partir
    do schema seguindo as convenções do Prisma: 10 enums, 20 tabelas (13 com `version`), índices (incl. o
    único `Locacao_chaveProdutoAtivo_key`) e 23 FKs (RESTRICT nas obrigatórias, SET NULL nas opcionais
    depositoId/cobrancaId/saldoId). `migration_lock.toml` com provider postgresql. Validada por checagem
    estrutural automática (20/20 tabelas, 10/10 enums, 23 FKs, tipos/defaults/ações conferidos).
63. **Scripts** no `packages/api/package.json`: `prisma:migrate:deploy` (prod/CI), `:status`, `:baseline`
    (`resolve --applied 0_init` para banco já existente via db push) e `:verify` (gera o SQL autoritativo via
    `migrate diff` para conferir byte-a-byte). Fluxo documentado em `MIGRACAO.md`.
64. **CI**: job e2e passou de `prisma db push` para `prisma migrate deploy` — a própria migration é exercitada
    a cada push contra um Postgres limpo (paridade de produção + validação real do SQL).
    Observação honesta: não pude executar `migrate deploy` aqui (sem engine prisma/rede); o primeiro run de
    CI/`:verify` é o teste definitivo do SQL — se o `:verify` acusar diferença, substituir pelo gerado.

## Rodada CI hardening — o pipeline passa a enforçar o que validamos

65. **Furo no CI corrigido**: o job `verificacao-rapida` só fazia build do core + testes + harnesses — **não**
    rodava `next build` (o check que pegou o dual React!), `nest build`, `tsc` do mobile nem ESLint. Ou seja,
    as garantias estáticas das 8 rodadas não estavam protegidas. Agora o job roda: prisma generate → build
    core/api/web → `tsc --noEmit` mobile → ESLint nos 4 → testes do core → 4 harnesses. Adicionados scripts
    `lint` em api e mobile (`eslint src`).
66. **Bug latente de YAML**: a linha do `echo` em `build-mobile` tinha `:` + espaço num escalar não-quotado
    (`rode: npx`) — YAML inválido que nunca pegou porque o job só roda em `main` e não houve push real no
    Actions. Corrigido com block scalar. Validado com `yaml.safe_load`.
67. **Outros ajustes**: `concurrency` (cancela runs antigos do mesmo ref), `needs: verificacao-rapida` em
    e2e e build-mobile (não sobe Postgres/EAS se a estática falhar), e Postgres 15→16 (paridade com o que
    foi validado localmente).

## Rodada CI hardening (cont.) — lint do mobile vs harness CommonJS

68. Ao ligar `lint` do mobile no CI, o `eslint src` passou a escanear `src/sync/sync-harness.js` (CommonJS,
    `require`) → erro `no-var-requires`. Causa raiz: o `ignorePatterns` da raiz era `**/*.harness.js` (ponto),
    que NÃO casa com `sync-harness.js` (hífen) — só não pegava antes porque os harnesses da API ficam em
    `test/` (fora do `eslint src`). Fixes: (a) `packages/mobile/.eslintignore` com `*-harness.js` (padrão
    verificado que casa); (b) corrigido o glob da raiz para `**/*-harness.js`. Validado o match por fnmatch.
