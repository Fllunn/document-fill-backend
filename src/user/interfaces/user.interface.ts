import mongoose from "mongoose"
import type { Role } from "../../roles/interfaces/role.interface";
import { AuthMethod } from "../../types/auth-method.type";

export interface User {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
  password: string
  roles: Role[]
  fileCount?: number; // количество загруженных файлов, оно нужно для ограничения
  
  authMethods: AuthMethod[]
}