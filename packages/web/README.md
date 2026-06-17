# @app/web — Painel administrativo (Next.js 14)

App Router + Tailwind + Recharts + **Leaflet** (sem Google Maps). Consome a API NestJS.

## Identidade visual
Ferramenta operacional, não landing page: prioriza densidade e clareza. A identidade vem do domínio —
**verde feltro** de mesa de sinuca na navegação, acento **latão** (cor de ficha), e valores monetários em
fonte **mono** (`.valor`) como numa fita de caixa. Tokens em `tailwind.config.ts` / `globals.css`.

## Estrutura
- `lib/api.ts` — cliente da API com Bearer token (localStorage); 401 → redireciona ao login.
- `lib/auth.tsx` — contexto de sessão (login, logout, `pode(permissao)`); botões/ações respeitam a permissão.
- `components/Shell.tsx` — layout com navegação lateral; `(painel)/layout.tsx` protege as rotas.
- `app/login` — autenticação.
- `app/(painel)/dashboard` — indicadores + gráfico de faturamento por rota (Recharts), com estado vazio honesto.
- `app/(painel)/clientes` — CRUD de referência (tabela + diálogo criar/editar, exclusão), ações por permissão.
- `app/(painel)/produtos` — lista + aba "Em depósito".
- `app/(painel)/mapa` — `MapaClientes` (react-leaflet, SSR-safe) plotando endereços com coordenadas.
- `app/(painel)/relatorios` — catálogo dos 14 relatórios (geração na Fase 6).

## Pronto / pendente
Pronto: shell, auth+permissões, dashboard, mapa Leaflet, e os CRUDs de **clientes, produtos, usuários
(com rotas + permissões por módulo + papéis), rotas, depósitos e auxiliares** (tipos/tamanhos/condições,
via componente `CrudSimples` genérico).
Também: **registro de cobrança** no painel com pré-visualização ao vivo via `@app/core`.
Também: **locações** (criar/finalizar) e **relatórios** ligados ao backend (faturamento por rota + inadimplência) com export PDF/Excel.
Também: **endereço cadastrado no cliente** — embutido na criação (transacional) e gerenciado na edição via `GerenciadorEnderecos`, com picker de coordenadas (`MapaSeletor`, Leaflet editável).
E **logs de auditoria** (filtro + paginação) e **configurações** (credenciais Mercado Pago criptografadas + tolerância de dias). Painel completo.

## Rodar
```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000 npm -w @app/web run dev
```
