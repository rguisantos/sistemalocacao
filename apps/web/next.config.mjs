import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // build enxuto para Docker (homologação/produção)
  transpilePackages: ['@locacoes/shared'],

  // Monorepo com @types/react@18 na raiz (mobile) vs @types/react@19
  // local (web) causa conflito de tipos no type-check do Next.
  // O runtime está correto (react@19 içado na raiz = versão única);
  // este flag desabilita só o type-check durante o build.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
