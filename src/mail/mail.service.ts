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
      case 'register-email':
        subject = `${this.APP_NAME}: код для регистрации`
        title = 'Ваш код для регистрации'
        break
      case 'login-email':
        subject = `${this.APP_NAME}: код для входа`
        title = 'Ваш код для входа'
        break
      case 'change-current-email':
        subject = `${this.APP_NAME}: код для подтверждения текущей почты`
        title = 'Ваш код для подтверждения текущей почты'
        break
      case 'change-new-email':
        subject = `${this.APP_NAME}: код для подтверждения новой почты`
        title = 'Ваш код для подтверждения новой почты'
        break
      case 'set-password':
        subject = `${this.APP_NAME}: код для установки пароля`
        title = 'Ваш код для установки пароля'
        break
      case 'change-password':
        subject = `${this.APP_NAME}: код для смены пароля`
        title = 'Ваш код для смены пароля'
        break
      case 'reset-password':
        subject = `${this.APP_NAME}: код для сброса пароля`
        title = 'Ваш код для сброса пароля'
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
