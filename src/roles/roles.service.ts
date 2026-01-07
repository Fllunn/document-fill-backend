import { Injectable } from '@nestjs/common';
import { Role } from './interfaces/role.interface'
import mongoose from 'mongoose';

@Injectable()
export class RolesService {
  getTypeFromRole(role: Role): string {
    return role.type
  }
  isAdmin(roles: Role[]): boolean {
    return roles.map((role: Role) => (role.type)).includes("admin")
  }
  isManager(roles: Role[]): boolean {
    return roles.map((role: Role) => (role.type)).includes("manager")
  }

  // getRolesWithRest(roles: Role, org_id: string): string[] {
  //   roles.push(`manager-${org_id}`)
  //   return roles
  // }

  // getRolesWithoutRest(roles: Role, org_id: string): string[] {
  //   return roles.filter(role => !role.includes(`manager-${org_id}`))
  // }

  //is some admin


  // getType(roles: string[]): string {
  //   if (this.isGlobalAdmin(roles))
  //     return 'глобальный админ'

  //   if (this.isSomeAdmin(roles))
  //     return 'админ'

  //   return 'пользователь'
  // }
}
