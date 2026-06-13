---
Task ID: 2
Agent: main
Task: Deploy API to Railway, Web to Vercel, and start EAS mobile build

Work Log:
- Installed Railway CLI and authenticated with token ea2fac24
- Discovered existing Railway project "app-cobrancas" with api service already online
- Found missing rotated_at/revoked_at columns in Neon database (migration was marked as applied but columns didn't exist)
- Added columns via direct SQL and created tracking migration 20241213000000_add_rotated_revoked
- Redeployed API to Railway with railway up
- API running at https://api-production-71e3.up.railway.app
- API login tested successfully with admin user
- Installed Vercel CLI and authenticated with token vcp_0RFjeb
- Found existing Vercel projects linked to sistemalocacao repo (all with errors)
- Configured sistemalocacao-web project: rootDirectory=apps/web, framework=nextjs, custom installCommand for monorepo
- Disabled SSO protection on Vercel project (was blocking access)
- Set NEXT_PUBLIC_API_URL to https://api-production-71e3.up.railway.app
- Cleaned up spurious Vercel projects (my-project, sistemalocacao-api, sistemalocacao, web)
- After multiple configuration iterations, achieved successful deployment
- Web panel running at https://sistemalocacao-arcvzyxrm-rguisantos-projects.vercel.app
- Updated CORS_ORIGINS on Railway to include Vercel web URL
- Initialized EAS project and started Android APK build
- EAS build URL: https://expo.dev/accounts/rguisantoss/projects/locacoes-mobile/builds/59089079-b84a-4f13-82f8-2b4b1425b2ac

Stage Summary:
- API: Running on Railway at https://api-production-71e3.up.railway.app
- Web: Running on Vercel at https://sistemalocacao-arcvzyxrm-rguisantos-projects.vercel.app
- Mobile: EAS build in progress
- Database: Neon PostgreSQL with all migrations applied
- Redis: Upstash connected
- Fixed missing rotated_at/revoked_at columns in database
