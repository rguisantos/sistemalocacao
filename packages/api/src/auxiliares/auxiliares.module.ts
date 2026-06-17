import { Module } from '@nestjs/common';
import { TiposProdutoController, TamanhosController, CondicoesController } from './auxiliares.controllers';
import { TiposProdutoService, TamanhosService, CondicoesService } from './auxiliares.services';

@Module({
  controllers: [TiposProdutoController, TamanhosController, CondicoesController],
  providers: [TiposProdutoService, TamanhosService, CondicoesService],
})
export class AuxiliaresModule {}
