import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { MAX_EMAIL_LENGTH } from '../constants/auth.constants'
import { NAME_USER_MIN_LEN, NAME_USER_MAX_LEN } from 'src/user/constants/user.constants'

export class UpdateUserDto {
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  readonly email!: string

  @IsString()
  @MinLength(NAME_USER_MIN_LEN)
  @MaxLength(NAME_USER_MAX_LEN)
  readonly name!: string
}