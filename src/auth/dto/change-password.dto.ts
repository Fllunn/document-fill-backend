import { IsString, MinLength, MaxLength } from 'class-validator'
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '../constants/auth.constants'

export class ChangePasswordDto {
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  readonly oldPassword!: string

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  readonly newPassword!: string
}