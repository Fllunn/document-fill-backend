import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose';
import * as jwt from 'jsonwebtoken'
import { Model } from 'mongoose';
import { User } from 'src/user/interfaces/user.interface';
import { Token } from './interfaces/token.interface';
import { TokenClass } from './schemas/token.schema';

@Injectable()
export class TokenService {
	constructor(
		@InjectModel('Token') private TokenModel: Model<TokenClass>,
	) { }

	validateResetToken(token: string, secret: string): any {
		try {
			return jwt.verify(token, secret)
		} catch {
			return null
		}
	}

	createResetToken(payload: any, secret: string): string | null {
		try {
			return jwt.sign(payload, secret, { expiresIn: '7d' })
		} catch {
			return null
		}
	}

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

	async saveToken(refreshToken: string): Promise<Token> {
		return await this.TokenModel.create({ refreshToken })
	}

	async removeToken(refreshToken: string) {
		return await this.TokenModel.deleteOne({ refreshToken })
	}

	async findToken(refreshToken: string) {
		return await this.TokenModel.findOne({ refreshToken })
	}
}
