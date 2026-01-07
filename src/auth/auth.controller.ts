import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards, UploadedFiles, UseInterceptors, Query } from '@nestjs/common'
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import RequestWithUser from 'src/types/request-with-user.type';
import { UserFromClient } from 'src/user/interfaces/user-from-client.interface';
import { User } from 'src/user/interfaces/user.interface';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { MailService } from 'src/mail/mail.service';
import { Throttle } from '@nestjs/throttler';

import YaCloud from 'src/s3/bucket';
import * as sharp from "sharp";

// all about MongoDB
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { UserClass } from 'src/user/schemas/user.schema';


@Controller('auth')
export class AuthController {
	constructor(
		private AuthService: AuthService,
		private mailService: MailService,
		@InjectModel('User') private UserModel: Model<UserClass>,
	) { }

	@Throttle({
		default: {
			ttl: 60000,
			limit: 4,
			blockDuration: 5 * 60000
		}
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('registration')
	async registration(
		@Res({ passthrough: true }) res: Response,
		@Body() user: UserFromClient
	) {
		const userData = await this.AuthService.registration(user)

		if (process.env.NODE_ENV === 'production')
			await this.mailService.sendUserConfirmation(user);

		let refreshToken = userData.refreshToken

		let userDataToSend: any = { ...userData }
		delete userDataToSend.refreshToken;

		res.cookie(
			'refreshToken',
			refreshToken,
			{
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		).cookie(
			'token',
			userData.accessToken,
			{
				maxAge: 7 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		).cookie(
			'roles',
			JSON.stringify(userData.user.roles),
			{
				maxAge: 7 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		)
			.json(userDataToSend)
	}

	@Throttle({
		default: {
			ttl: 60000,
			limit: 5,
			blockDuration: 5 * 60000
		}
	})
	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(
		@Res({ passthrough: true }) res: Response,
		@Body('email') email: string,
		@Body('password') password: string
	) {
		const userData = await this.AuthService.login(email, password)

		let refreshToken = userData.refreshToken

		let userDataToSend: any = { ...userData }
		delete userDataToSend.refreshToken;

		res.cookie(
			'refreshToken',
			refreshToken,
			{
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		).cookie(
			'token',
			userData.accessToken,
			{
				maxAge: 7 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		).cookie(
			'roles',
			JSON.stringify(userData.user.roles),
			{
				maxAge: 7 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		)
			.json(userDataToSend)
	}

	@HttpCode(HttpStatus.OK)
	@Get('refresh')
	async refresh(
		@Req() req: Request,
		@Res() res: Response,
	) {
		const { refreshToken, token } = req.cookies

		// проверить, валиден ещё accessToken
		// если accessToken не валиден - сделать новый с помощью refreshToken
		const userData = await this.AuthService.refresh(refreshToken, token)
		// console.log(JSON.stringify(userData.user.roles));

		res.cookie(
			'refreshToken',
			refreshToken,
			{
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		)
		res.cookie(
			'token',
			userData.accessToken,
			{
				maxAge: 7 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		)
		res.json(userData.user)
	}

	@HttpCode(HttpStatus.OK)
	@Post('logout')
	async logout(
		@Req() req: Request,
		@Res() res: Response,
	) {
		const { refreshToken } = req.cookies

		await this.AuthService.logout(refreshToken)
		res.clearCookie('refreshToken').clearCookie('token').send()
	}

	@Throttle({
		default: {
			ttl: 60000,
			limit: 4,
			blockDuration: 5 * 60000
		}
	})
	@Post('reset-password')
	async resetPassword(
		@Res() res: Response,
		@Body('password') password: string,
		@Body('token') token: string,
		@Body('userId') userId: string
	) {
		const userData = await this.AuthService.resetPassword(password, token, userId)

		let refreshToken = userData?.refreshToken

		let userDataToSend: any = { ...userData }
		delete userDataToSend.refreshToken;

		res.cookie(
			'refreshToken',
			refreshToken,
			{
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		).cookie(
			'token',
			userData?.accessToken,
			{
				maxAge: 7 * 24 * 60 * 60 * 1000,
				httpOnly: !eval(process.env.HTTPS),
				secure: eval(process.env.HTTPS),
				domain: process.env?.DOMAIN ?? ''
			}
		).json(userDataToSend)
	}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.OK)
	@Post('update')
	async update(
		@Body('user') newUser: UserFromClient,
		@Body('userId') userId: string
	) {
		return await this.AuthService.update(newUser, userId)
	}

	@HttpCode(HttpStatus.OK)
	@Post('send-reset-link')
	async sendResetLink(
		@Body('email') email: string
	) {
		let link = await this.AuthService.sendResetLink(email)
		return link
	}

	@Post('upload-avatar')
	@UseInterceptors(AnyFilesInterceptor())
	async uploadAvatar(
		@UploadedFiles() files: Array<Express.Multer.File>,
		@Query('user_id') userId: String,
	) {
		let filenames: string[] = [];

		for (let file of files) {
			if (file.originalname.startsWith('avatar')) {
				file.buffer = await sharp(file.buffer).resize(300, 300).toBuffer()
			}
			let uploadResult: any = await YaCloud.Upload({
				file,
				path: 'avatars',
				fileName: file.originalname,
			});
			filenames.push(uploadResult.Location);
		}

		if (filenames.length == 0) return

		return await this.UserModel.findByIdAndUpdate(userId, { $set: { avatars: [filenames[0]] } });
	}

	@Throttle({
		default: {
			ttl: 60000,
			limit: 4,
			blockDuration: 5 * 60000
		}
	})
	@HttpCode(HttpStatus.OK)
	@Post("validate-manager-invite-token")
	async validateManagerInviteToken(
		@Body("inviteToken") inviteToken: string
	) {
		return false;
	}
}
