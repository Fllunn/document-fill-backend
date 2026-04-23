import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, MAX_EMAIL_LENGTH } from '../constants/auth.constants'

import { Transform } from 'class-transformer'

export class LoginDto {
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  readonly email!: string

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  readonly password!: string
}