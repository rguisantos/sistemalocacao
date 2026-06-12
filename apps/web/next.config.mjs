/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@locacoes/shared'],
  skipTrailingSlashRedirect: true,
  // React 19 + TanStack Query: prerender de /404 e /500 crasha por
  // useContext null no SSG. Ignorar erros de build até atualizar.
  // O type-check (tsc) já passa; o erro é só no SSG de páginas de erro.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
