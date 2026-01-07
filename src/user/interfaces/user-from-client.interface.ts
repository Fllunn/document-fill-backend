import type { Role } from "../../roles/interfaces/role.interface";

export interface UserFromClient {
  name: string
  surname: string
  email: string
  password: string
  avatars: string[]
  roles: string[]
}
