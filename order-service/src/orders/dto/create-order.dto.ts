import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Schéma d'entrée pour créer une commande.
 */
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  item: string;
}
