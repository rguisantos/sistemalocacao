# @app/mobile — App do Cobrador (Expo, offline-first)

React Native + Expo (Dev Client), **SQLite** local e **Leaflet** para mapa/GPS. Reusa o `@app/core`
para o cálculo de cobrança on-device (mesma matemática do servidor).

## Arquitetura offline-first
- **`db/`** — SQLite (`expo-sqlite`) espelhando as entidades sincronizáveis, com metadados
  `_syncStatus` (`synced`/`created`/`updated`) e `_lastModified`. Valores monetários em TEXT (precisão).
- **`sync/`** — cliente de sincronização contra os endpoints `/sync`:
  - **pull**: baixa mudanças, faz upsert genérico (via PRAGMA), **aplica tombstones** (remove local)
    e guarda o `serverTimestamp` como `lastPulledAt` (relógio do servidor).
  - **push**: coleta registros sujos, envia com `idempotencyKey`, marca como `synced` os aceitos;
    conflitos ficam sujos e são corrigidos no próximo pull (servidor vence).
  - `sincronizar()` = push depois pull.
- **`auth/`** — login online (tokens no SecureStore) com **fallback offline** por hash local salgado;
  reset/refresh de token.
- **`dominio/`** — `cobranca-local` registra a cobrança **offline** reusando `@app/core` (memorial,
  saldo recalculado localmente) gravando `cobranca`+`pagamento` como `created`; `repositorios`
  alimenta a UI (rotas, clientes com flag de saldo, abas de locação/saldo devedor).
- **`ui/`** — telas Login → Rotas → Clientes → Cliente (abas) → Registrar cobrança; componente
  **`MapaLeaflet`** (WebView + `expo-location`).

## Verificação
`npm -w @app/mobile run test:sync` roda o harness do cliente de sync (upsert, tombstone, push de
sujos, conflito) — 7/7.

## Recibo e impressão
`dominio/recibo.ts` gera o recibo em HTML (PDF via `expo-print`) e em **ESC/POS** (papel 58/60mm) —
função pura validada por harness (`test:sync` cobre o sync; o recibo tem verificação de bytes própria).
`dominio/impressao.ts` imprime o PDF (compartilhamento) ou envia os bytes à impressora Bluetooth
(`react-native-thermal-receipt-printer`, exige Dev Client + pareamento). Botão "Ver recibo (PDF)" na
tela de cobrança.

## Background sync
`sync/background.ts` registra `expo-background-fetch` para `sincronizar()` a cada ~30 min, além do
botão manual.

## Criação em campo (offline-first)
O cobrador cria **cliente (com endereço + GPS), produto e locação** direto no app (telas `NovoCliente`,
`NovoProduto`, `NovaLocacao`). Os registros gravam como `created` e sobem no próximo push, na ordem de
dependência; o servidor deriva o saldo.

## Edição em campo
`EditarCliente` (com gestão de endereços + GPS), `EditarProduto` e `EditarLocacao`. A edição preserva o
estado de sync (`created` continua create; `synced` vira `updated`), sem mexer na `version` (o servidor
resolve no pull). Listagem de produtos em `Produtos`.

## Pendente (mesma base)
Cadastro/edição de cliente com o mapa e PIX Mercado Pago (online) na tela de cobrança.

## Rodar
```bash
npm install
EXPO_PUBLIC_API_URL=http://SEU_IP:3000 npm -w @app/mobile run start
```


## Visual / navegação
Tema central em `src/ui/tema.ts` e kit em `src/ui/componentes/kit.tsx`. Navegação por **abas**
(Início, Rotas, Produtos, Mais) com formulários em modal. A tela **Início** é um dashboard com métricas
locais e ações rápidas. Paleta do domínio (verde feltro + latão) com o polimento (cartões, chips de ícone,
badges de status) inspirado no app de referência.
