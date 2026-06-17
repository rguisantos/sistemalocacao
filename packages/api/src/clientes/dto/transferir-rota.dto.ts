import { IsInt, IsUUID } from 'class-validator';
export class TransferirRotaDto {
  @IsUUID() rotaId: string;
  @IsInt() version: number;
}
