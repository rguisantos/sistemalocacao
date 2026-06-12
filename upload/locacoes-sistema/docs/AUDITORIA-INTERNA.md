# Auditoria interna do código — correções aplicadas

Revisão sistemática realizada antes do primeiro deploy. Todos os itens abaixo já estão corrigidos no código.

## Críticos

**1. Idempotência de cobrança com janela de corrida** — `registrarCobranca` fazia *check-then-create* (`findFirst` por `syncOrigemId` e depois `create`). Dois pushes simultâneos do mesmo aparelho (retry de rede) podiam ambos passar o check e **duplicar a cobrança e o débito do cliente**.
✅ `syncOrigemId` agora tem índice `@unique` no Postgres (NULLs múltiplos permitidos) e o serviço captura `P2002`, devolvendo a cobrança vencedora como `duplicada: true`. A garantia passou a ser do banco, não do código.

**2. Sessão do painel web não sobrevivia ao reload** — o `usuario` ficava só no Zustand (memória). Ao recarregar: menus por permissão sumiam, queries protegidas quebravam e não havia guard — `/painel` abria "logado-fantasma".
✅ `restaurarSessao()` troca o refreshToken persistido por novos tokens (a rota `/refresh` já devolve o `UsuarioDTO` completo) e o `Shell` ganhou guard: restaura ou redireciona para `/login`, com estado de carregamento.

## Altos

**3. Webhook PIX recalculava o saldo ignorando a regra da locação** — usava `valorLiquidoFinal − valorPago` direto. Em `PERCENTUAL_A_PAGAR` o saldo é invertido (pago − devido); o webhook corromperia o saldo. Também marcava `PAGO` mesmo em pagamento parcial.
✅ Agora usa `calcularSaldoResultante` e `determinarStatusPagamento` do engine compartilhado — o mesmo caminho das cobranças manuais — e grava `saldoResultante` na cobrança.

**4. Reuso de refresh token revogado não disparava resposta de segurança** — reuso de token rotacionado é o sinal clássico de token vazado; o código só retornava 401 genérico.
✅ Reuso fora da janela de tolerância revoga **todas** as sessões do usuário e gera log de auditoria `refresh_token_reuso_detectado`.

**5. Detecção de reuso × múltiplas abas (regressão evitada)** — a correção nº 4, sozinha, derrubaria usuários legítimos: aba A rotaciona, aba B usa o token antigo → falso positivo de roubo.
✅ Janela de tolerância de 60s no servidor para tokens recém-rotacionados (corridas benignas de multi-tab/retry) + listener de `storage` no front que propaga o token novo entre abas instantaneamente.

## Médios

**6. Build de produção da API quebraria no primeiro `npm start`** — `tsc` emitia JS importando `@locacoes/shared`, cujo `main` aponta para `.ts` puro; o Node não carrega TypeScript.
✅ `start` roda via `tsx` (movido para `dependencies`); `build` virou type-check (`tsc --noEmit`). Alternativa com `exports` + pré-build documentada no README.

**7. Cobranças offline enviadas fora de ordem** — `coletarPendentes` lia cobranças sem `ORDER BY`. Duas cobranças offline da mesma locação podiam chegar invertidas, fazendo o servidor calcular `contadorAnterior`/períodos com referência errada.
✅ Push agora ordena por `data_cobranca ASC`, preservando a cronologia do cálculo no servidor.

**7b. Push do mobile entrava em loop infinito com registro rejeitado** — quando o servidor retornava `error` para um registro (validação Zod, regra de negócio), o mobile só logava no console e mantinha `PENDING_*`: o mesmo registro inválido era reenviado em **todo** sync, para sempre, sem visibilidade para o cobrador.
✅ Novo estado `SYNC_ERROR` + tabela local `sync_erros`: o registro sai da fila de reenvio e aparece na tela "Pendências de Sincronização" (faixa de alerta na lista de clientes), com ações de *tentar novamente* (revalida) ou *descartar* (criações rejeitadas são removidas; edições voltam ao estado do servidor no próximo pull).

## Baixos

**8. E-mail do pagador PIX hardcoded** (`pagamento@sistema.local`, domínio inválido que o MP pode rejeitar) → variável `MERCADOPAGO_PAYER_EMAIL` validada por Zod.
**8b. Logs sem estrutura e sem redação** — `pino`/`pino-http` estavam nas dependências mas nunca foram plugados; logs eram `console.*` esparsos, e um log acidental de request poderia vazar `Authorization`/senha.
✅ `pino-http` com request-id (correlação), redação de `authorization`, `cookie`, `senha` e `refreshToken`, nível por status (warn ≥400, error ≥500) e `/health` silenciado.

**8c. Shutdown abrupto** — deploy/restart matava o processo no meio de transações de cobrança.
✅ Graceful shutdown em SIGTERM/SIGINT: para de aceitar conexões, aguarda as em andamento, desconecta o Prisma, com timeout de força de 10s.

**9. Ternário sem efeito no dashboard** (`faturamento ? x : '0'` — `faturamento` é sempre truthy) → removido.

## Limitações conhecidas (documentadas, sem ação)

- **Relógio do aparelho**: `version` usa timestamp local; relógio muito errado distorce o last-write-wins. Mitigado pelo `baseVersion` (fast-forward independe de relógio).
- **Rate limit em memória** (sem Redis) reseta a cada deploy/instância — o log avisa; obrigatório Redis em produção serverless.
- **Cobranças offline muito antigas** intercaladas com cobranças online podem gerar saldo recalculado em ordem diferente da física; a fila de conflitos e a auditoria dão visibilidade para correção manual.
