# Correções do Relatório de Verificações (16/06/2026)

Mapa item-do-relatório → status. "Corrigido" = alterado no código; "Resolve via generate" = some ao rodar
`prisma generate` após o schema corrigido; "Já estava" = o relatório testou um zip anterior.

## P0 (bloqueantes)
| Item | Status | O que foi feito |
|------|--------|-----------------|
| Schema Prisma: enums inline | **Corrigido** | 10 enums reformatados (um valor por linha) em `database/prisma/schema.prisma` |
| Export duplicado `Frequencia` (core) | **Corrigido** | `calculo.ts` deixou de exportar; passou a importar de `./datas` |
| `react-native-thermal-receipt-printer ^1.2.0` inexistente | **Corrigido** | `package.json` mobile → `^1.1.5` |
| Sem `package-lock.json` | **Mitigado** | CI trocado para `npm install` (TODO: voltar a `npm ci` após versionar o lockfile — exige `npm install` com rede) |

## P1
| Item | Status | O que foi feito |
|------|--------|-----------------|
| 54 erros TS na API (cascata Prisma) | **Resolve via generate** | A causa-raiz era o schema inválido (Prisma Client nunca gerado). Com o schema corrigido, `prisma generate` restitui `Prisma.PrismaClientKnownRequestError`, `Prisma.UsuarioSelect/UpdateInput` e tipa os resultados (some TS2339/TS2694/TS18046 e a maioria dos TS7006) |
| 28x implicit any (TS7006) | **Parcial + via generate** | Callbacks de `$transaction` anotados com `tx: Prisma.TransactionClient` em 5 arquivos (+ `import { Prisma }` onde faltava); os demais são sobre resultados Prisma e tipam após o generate |
| supertest namespace import | **Corrigido** | `import * as request` → `import request` nos 3 specs e2e |
| `@types/react` mismatch (web) | **Corrigido** | `overrides` no `package.json` raiz fixando `@types/react@18.3.12` e `@types/react-dom@18.3.1` |
| expo-sqlite API incompatível | **Corrigido** | `database.ts` importa de `expo-sqlite/next` (API async já disponível no SDK 50; virou padrão no 51). `runAsync`/`getAllAsync`/etc. passam a existir |
| Buffer cast em exportacao | **Corrigido** | `Buffer.from(await wb.xlsx.writeBuffer())` |
| JWT sign types (core) | **Corrigido** | `{ expiresIn } as jwt.SignOptions` nas duas chamadas |
| ESLint não configurado | **Corrigido** | `.eslintrc.json` raiz (TS) + `packages/web/.eslintrc.json` (`next/core-web-vitals`, não-interativo) + devDeps eslint na raiz/core/web |
| `next lint` interativo | **Corrigido** | config do web criado |
| Refresh token não implementado (web) | **Já estava** | `tentarRefresh()` + retry em `req()` e `baixar()` já presentes em `lib/api.ts` (relatório testou zip anterior) |

## P2
| Item | Status | O que foi feito |
|------|--------|-----------------|
| `@types/uuid` ausente (mobile) | **Corrigido** | adicionado em devDependencies (`^9.0.8`) |
| Dynamic import module (mobile) | **Corrigido** | `tsconfig` mobile com `"module": "esnext"`, `"moduleResolution": "bundler"` |
| Harness de finalização ausente | **Já estava** | `packages/api/test/finalizacao-harness.js` presente (7/7); relatório testou zip anterior |
| Specs e2e p/ fluxos novos | **Pendente** | recomendado adicionar (finalização→relocação, quitação, lista de cobrança) — depende de infra |
| Testes UI mobile | **Pendente** | sugerido RN Testing Library/Detox |
| Soma float na lista de cobrança | **Documentado** | total é guia aproximado; itens usam Decimal |
| Migrations Prisma | **Pendente** | usar `prisma migrate dev` p/ produção; hoje `db push` |
| 77 vulnerabilidades npm | **Pendente** | rodar `npm audit fix` (exige rede); avaliar upgrades com breaking changes |

## Observação importante
O relatório indicou dois itens como ausentes/não-implementados (harness de finalização e refresh de token no web)
que **já estavam presentes** no código entregue — sugere que a verificação rodou sobre um pacote anterior.
Recomenda-se re-rodar a suíte sobre o `locacoes-cobrancas.zip` atual, em especial após `npm install` +
`prisma generate`, que deve eliminar a maior parte dos 54 erros da API de uma vez.
