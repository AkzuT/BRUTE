import { Controller, Get } from "@nestjs/common";

import { MailerService } from "./mailer.service";

import { MailerURL, MailerEndpoint, MailerTemplate, MailerSubject, EmailMessage } from "./mailer.enums";

@Controller("mailer")
export class MailerController {
    constructor(
        private readonly mailerService: MailerService
    ) {}

    @Get("test")
    async sendTest() {
        const builder = this.mailerService.buildEmail(
            "test@email.com",
            MailerTemplate.UNPRIVILEGED_ACTIVATION,
            "test",
            {
                // endpoint: MailerEndpoint.UNPRIVILEGED_ACTIVATION,
                // token: "test-token-12345"
            }
        );

        await this.mailerService.sendEmail(MailerSubject.UNPRIVILEGED_ACTIVATION, builder);
        return { message: "Email sent" }
    }
}
