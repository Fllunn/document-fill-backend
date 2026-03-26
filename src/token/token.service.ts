import { Injectable } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import { User } from 'src/user/interfaces/user.interface';
import Redis from 'ioredis';

@Injectable()
export class TokenService {
	private readonly redis = new Redis({
		host: process.env.REDIS_HOST,
		port: Number(process.env.REDIS_PORT),
		password: process.env.REDIS_PASSWORD || undefined,
		db: Number(process.env.REDIS_DB ?? 0),
	});

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
			return jwt.sign(payload, secret, { expiresIn: '7d' })
		} catch {
			return null
		}
	}

  // генерация access и refresh токенов
	generateTokens(payload: any): { accessToken: string | null, refreshToken: string | null } {
		try {
			const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '7d' })
			const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' })

			return { accessToken, refreshToken }
		} catch {
			return { accessToken: null, refreshToken: null }
		}
	}

  
	generateAccessToken(payload: any): string | null {
		try {
			const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '7d' })
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
		await this.redis.set(`rt:${refreshToken}`, '1', 'EX', 30 * 24 * 60 * 60)
	}

  // удаление refresh токена
	async removeToken(refreshToken: string): Promise<number> {
		return await this.redis.del(`rt:${refreshToken}`)
	}

  // проверяем, существует ли refresh токен
	async findToken(refreshToken: string): Promise<string | null> {
		const exists = await this.redis.exists(`rt:${refreshToken}`)
		return exists ? refreshToken : null
	}
}
