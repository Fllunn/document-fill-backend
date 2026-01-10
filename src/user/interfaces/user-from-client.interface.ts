import type { Role } from "../../roles/interfaces/role.interface";

export interface UserFromClient {
  _id: string
  name: string
  email: string
  password: string
  avatars: string[]
  roles: string[]
}
