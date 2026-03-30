import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import ApiError from 'src/exceptions/errors/api-error';

// types
import type { User } from 'src/user/interfaces/user.interface'

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) { }

  private readonly APP_NAME = 'DocumentFill'
  private readonly MAIL_USER = process.env.MAIL_USER

  public async sendJobFormCreatedNotification(email: string, name: string) {
    let registerUrl = `${process.env.CLIENT_URL}/registration/employee?email=${email}`

    await this.mailerService.sendMail({
      to: email,
      from: `"${this.APP_NAME}" <${this.MAIL_USER}>`,
      subject: 'DocumentFill: анкета создана',
      template: './job-form-created',
      context: {
        name: name,
        registerUrl: registerUrl
      },
    })
  }

  public async sendUserConfirmation(user: any) {
    // const url = `example.com/auth/confirm?token=${token}`;
    await this.mailerService.sendMail({
      to: user.email,
      from: `"${this.APP_NAME}" <${this.MAIL_USER}>`,
      subject: 'DocumentFill: регистрация успешна',
      template: './confirmation',
      context: {
        name: user.name,
        clientUrl: process.env.CLIENT_URL,
        // url,
      },
    });
  }

  public async sendResetLink(link: string, email: string) {
    return await this.mailerService.sendMail({
      to: email,
      from: `"${this.APP_NAME}" <${this.MAIL_USER}>`,
      subject: 'DocumentFill: восстановление пароля',
      template: 'reset-pasword',
      context: { link }
    });
  }

  public async sendVerificationCode(email: string, code: string, type: string) {
    let subject = ''
    let title = ''

    switch (type) {
      case 'email-verification':
        subject = `${this.APP_NAME}: код для подтверждения почты`
        title = 'Ваш код для подтверждения почты'
        break
      case 'password-reset':
        subject = `${this.APP_NAME}: код для сброса пароля`
        title = 'Ваш код для сброса пароля'
        break
      case 'enable-2fa':
        subject = `${this.APP_NAME}: код для включения двухфакторной аутентификации`
        title = 'Ваш код для включения двухфакторной аутентификации'
        break
      case 'disable-2fa':
        subject = `${this.APP_NAME}: код для отключения двухфакторной аутентификации`
        title = 'Ваш код для отключения двухфакторной аутентификации'
        break
      default:
        throw ApiError.BadRequest('Неверный тип кода')
    }

    await this.mailerService.sendMail({
      to: email,
      from: `"${this.APP_NAME}" <${this.MAIL_USER}>`,
      subject,
      template: './verification-code',
      context: {
        title,
        code
      }
    })
  }
}
