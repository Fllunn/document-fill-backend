import { Injectable } from '@nestjs/common';
import { Role } from './interfaces/role.interface'
import mongoose from 'mongoose';

@Injectable()
export class RolesService {
  getTypeFromRole(role: Role): string {
    return role.type
  }
  isAdmin(roles: any[]): boolean {
  return roles.some(role => {
      if (typeof role === 'string') return role.toLowerCase() === 'admin';
      if (typeof role === 'object' && role.type) return role.type.toLowerCase() === 'admin';
      return false;
    });
  }

  
}
