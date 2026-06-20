import { Module } from '@nestjs/common';
import { TiposProdutoController, TamanhosController, CondicoesController, CoresController } from './auxiliares.controllers';
import { TiposProdutoService, TamanhosService, CondicoesService, CoresService } from './auxiliares.services';

@Module({
  controllers: [TiposProdutoController, TamanhosController, CondicoesController, CoresController],
  providers: [TiposProdutoService, TamanhosService, CondicoesService, CoresService],
})
export class AuxiliaresModule {}
