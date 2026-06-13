import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // build enxuto para Docker (homologação/produção)
  transpilePackages: ['@locacoes/shared'],

  // MONOREPO: garante que TODA importação de react/react-dom resolva a
  // ÚNICA cópia em apps/web/node_modules — mesmo que algo na raiz tenha
  // outra versão. Elimina o "Cannot read properties of null (useContext)"
  // do prerender, de forma independente do hoisting do npm.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    };
    return config;
  },

  // O standalone precisa saber a raiz do monorepo para empacotar certo.
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
};

export default nextConfig;
