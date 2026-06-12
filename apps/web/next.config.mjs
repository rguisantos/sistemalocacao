/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // build enxuto para Docker (homologação/produção)
  transpilePackages: ['@locacoes/shared'],
};
export default nextConfig;
