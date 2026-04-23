import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, MAX_EMAIL_LENGTH } from '../constants/auth.constants'
import { NAME_USER_MIN_LEN, NAME_USER_MAX_LEN } from 'src/user/constants/user.constants'

import { Transform } from 'class-transformer'

export class RegisterDto {
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsEmail({}, {
    message: 'Некорректный email',
  })
  @MaxLength(MAX_EMAIL_LENGTH)
  readonly email!: string

  @Transform(({ value }) => value.trim())
  @IsString()
  @MinLength(NAME_USER_MIN_LEN)
  @MaxLength(NAME_USER_MAX_LEN)
  readonly name!: string

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  readonly password!: string
}