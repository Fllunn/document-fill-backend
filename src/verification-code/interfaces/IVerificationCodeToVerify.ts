import { VCodeType } from 'src/types/verification-code.type'

/**
 ** tempUserId
 ** code
 ** type
 */
export interface IVerificationCodeToVerify {
  tempUserId: string
  code: string
  type: VCodeType
}
