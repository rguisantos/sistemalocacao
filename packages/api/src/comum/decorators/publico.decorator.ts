import { SetMetadata } from '@nestjs/common';
/** Marca uma rota como pública (sem JWT). Ex.: login. */
export const PUBLICO = 'publico';
export const Publico = () => SetMetadata(PUBLICO, true);
