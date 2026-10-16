import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { ExpiringStoreModule } from 'src/expiring-store/expiring-store.module';

@Module({
  imports: [
    JwtModule,
    ExpiringStoreModule,
  ],
  providers: [TokenService],
  exports: [TokenService]
})
export class TokenModule {}
