import { IsString, MaxLength } from 'class-validator';

export class UpdatePhotoDto {
  @IsString()
  @MaxLength(100)
  readonly name: string;
}
