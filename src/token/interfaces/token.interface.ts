import mongoose from "mongoose"

export enum TokenType {
  VERIFICATION = "VERIFICATION",
  TWO_FACTOR = "TWO_FACTOR",
  PASSWORD_RESET = "PASSWORD_RESET",
}

export interface Token {
  _id: mongoose.Types.ObjectId
  token: string
  type: TokenType
  expiresIn: Date
}
