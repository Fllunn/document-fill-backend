import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

// types
import type { User } from 'src/user/interfaces/user.interface'

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) { }


  public async sendJobFormCreatedNotification(email: string, name: string) {
    let registerUrl = `${process.env.CLIENT_URL}/registration/employee?email=${email}`

    await this.mailerService.sendMail({
      to: email,
      from: '"DocumentFill" <dmitrijpohoda2960@gmail.com>',
      subject: 'DocumentFill: анкета создана',
      template: './job-form-created', // `.hbs` extension is appended automatically
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
      from: '"DocumentFill" <dmitrijpohoda2960@gmail.com>', // override default from
      subject: 'DocumentFill: регистрация успешна',
      template: './confirmation', // `.hbs` extension is appended automatically
      context: { // ✏️ filling curly brackets with content
        name: user.name,
        clientUrl: process.env.CLIENT_URL,
        // url,
      },
    });
  }

  public async sendOrderNotifications(userEmails: string[], order: any) {
    return await this.mailerService.sendMail({
      to: userEmails,
      from: '"DocumentFill" <dmitrijpohoda2960@gmail.com>', // override default from
      subject: 'DocumentFill: новый заказ',
      template: 'order', // `.hbs` extension is appended automatically
      context: { order: order._doc }
    });
  }

  public async sendResetLink(link: string, email: string) {
    return await this.mailerService.sendMail({
      to: email,
      from: '"DocumentFill" <dmitrijpohoda2960@gmail.com>', // override default from
      subject: 'DocumentFill: восстановление пароля',
      template: 'reset-pasword', // `.hbs` extension is appended automatically
      context: { link }
    });
  }
}
