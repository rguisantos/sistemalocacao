// Barrel de exports do núcleo compartilhado — SOMENTE PARA Node.js (API).
// Inclui módulos de seguranca que dependem de APIs inexistentes no React Native
// (crypto para jsonwebtoken, Redis para rate-limit).
export * from './money';
export * from './datas';
export * from './calculo';
export * from './sync/contrato';
export * from './sync/resolver';
export * from './seguranca/jwt';
export * from './seguranca/rate-limit';
