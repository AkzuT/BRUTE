import { Controller, Get } from "@nestjs/common";

import { MailerService } from "./mailer.service";

import { MailerURL, MailerEndpoint, MailerTemplate, MailerSubject } from "./mailer.enums";

@Controller("mailer")
export class MailerController {
    constructor(
        private readonly mailerService: MailerService
    ) {}

    @Get("test")
    async sendTest() {
        const builder = this.mailerService.buildEmail(
            "test@email.com",
            MailerTemplate.NOTIFY_EVENT,
            "Test",
            MailerURL.PUBLIC_WEB_URL,
            MailerEndpoint.UNPRIVILEGED_ACTIVATION,
            "test-token-12345",
        );

        await this.mailerService.sendEmail(MailerSubject.UNPRIVILEGED_ACTIVATION, builder);
        return { message: "Email sent" }
    }
}
