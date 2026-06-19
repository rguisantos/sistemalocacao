// Barrel de exports do núcleo compartilhado — compatível com React Native.
// Módulos de seguranca (JWT, rate-limit) ficam em ./server pois dependem
// de APIs exclusivas do Node.js (crypto, Redis) que não existem no RN.
export * from './money';
export * from './datas';
export * from './calculo';
export * from './sync/contrato';
export * from './sync/resolver';
