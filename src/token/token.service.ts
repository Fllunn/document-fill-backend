import { Injectable } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import { User } from 'src/user/interfaces/user.interface';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { RESET_TOKEN_EXPIRES_IN, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, REFRESH_TOKEN_TTL_SECONDS } from './constants/token.constants';

@Injectable()
export class TokenService {
	private readonly redis = new Redis({
		host: process.env.REDIS_HOST,
		port: Number(process.env.REDIS_PORT),
		password: process.env.REDIS_PASSWORD || undefined,
		db: Number(process.env.REDIS_DB ?? 0),
	});

  private getHashToken(token: string): string {
    return createHash('sha256').update(token + process.env.TOKEN_PEPPER).digest('hex')
  }

  // проверка reset токена
	validateResetToken(token: string, secret: string): any {
		try {
			return jwt.verify(token, secret)
		} catch {
			return null
		}
	}

  // создание reset токена
	createResetToken(payload: any, secret: string): string | null {
		try {
			return jwt.sign(payload, secret, { expiresIn: RESET_TOKEN_EXPIRES_IN })
		} catch {
			return null
		}
	}

  // генерация access и refresh токенов
	generateTokens(payload: any): { accessToken: string | null, refreshToken: string | null } {
		try {
			const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
			const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN })

			return { accessToken, refreshToken }
		} catch {
			return { accessToken: null, refreshToken: null }
		}
	}

  
	generateAccessToken(payload: any): string | null {
		try {
			const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
			return accessToken
		} catch (error) {
			return null
		}
	}

	validateAccessToken(token: string): User | null {
		try {
			return jwt.verify(token, process.env.JWT_ACCESS_SECRET) as User
		} catch {
			return null
		}
	}

	validateRefreshToken(token: string): User | null {
		try {
			return jwt.verify(token, process.env.JWT_REFRESH_SECRET) as User
		} catch {
			return null
		}
	}

  // сохраняем refresh токен
  // действует 30 дней, удаляется при выходе из аккаунта
	async saveToken(refreshToken: string): Promise<void> {
    refreshToken = this.getHashToken(refreshToken)

		await this.redis.set(`rt:${refreshToken}`, '1', 'EX', REFRESH_TOKEN_TTL_SECONDS)
	}

  // удаление refresh токена
	async removeToken(refreshToken: string): Promise<number> {
    refreshToken = this.getHashToken(refreshToken)

		return await this.redis.del(`rt:${refreshToken}`)
	}

  // проверяем, существует ли refresh токен
	async findToken(refreshToken: string): Promise<string | null> {
    const refreshTokenHash = this.getHashToken(refreshToken)

		const exists = await this.redis.exists(`rt:${refreshTokenHash}`)
		return exists ? refreshToken : null
	}
}
