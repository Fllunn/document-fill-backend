import { VCodeType } from 'src/types/verification-code.type'

/**
 ** tempUserId
 ** email
 ** type
 */
export interface IVerificationCodeToCreate {
  tempUserId: string
  email: string
  type: VCodeType
}
