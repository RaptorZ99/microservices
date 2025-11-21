import { IsNotEmpty, IsString } from 'class-validator';

export class AddBookDto {
  @IsString()
  @IsNotEmpty()
  workId: string;
}
