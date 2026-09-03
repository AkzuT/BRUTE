import { Injectable } from "@nestjs/common";
import { MailerService as MailService } from "@nestjs-modules/mailer";
import { createHmac, timingSafeEqual } from "crypto";
import { join } from "path";

import { getEnvCors } from "src/brute-api-config/env-config";

import { MailerURL, MailerEndpoint, MailerTemplate, type MailerBuilder, MailerSubject, EmailMessage } from "./mailer.enums";
import { ConfigService } from "@nestjs/config";
import { buffer } from "stream/consumers";

@Injectable()
export class MailerService {
    private readonly hmacKey: string;

    constructor(
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
    ) {
        const key = this.configService.get<string>("HMAC_KEY");

        if (!key) {
            throw new Error('Mailer-Service | CRITICAL ERROR: "HMAC_KEY" is undefined.');
        }

        this.hmacKey = key;
    }

    signURL(email: string): string {
        return createHmac("sha256", Buffer.from(this.hmacKey, "hex"))
        .update(email)
        .digest("hex");
    }

    verifyURLSignature(email: string, signature: string): boolean {
        const expected = Buffer.from(this.signURL(email), "hex");
        const provided = Buffer.from(signature, "hex");

        if (expected.length !== provided.length) return false

        return timingSafeEqual(expected, provided);
    }

    buildEmail(
        email: string,
        template: MailerTemplate,
        name: string,
        options?: {
            urlKey?: MailerURL,
            endpoint?: MailerEndpoint,
            token?: string,
            emailToSign?: string,   
            sig?: string,
            message?: EmailMessage,
            userAgent?: string
        }
    ) {
        let url: string | undefined;
        
        if (options?.urlKey && options?.endpoint && options?.token) {
            const baseUrl = getEnvCors(options?.urlKey);

            if (options?.emailToSign) {
                url = `${baseUrl}/${options?.endpoint}?token=${options?.token}&email=${options?.emailToSign}&sig=${options?.sig}`;
            } else {
                url = `${baseUrl}/${options?.endpoint}?token=${options?.token}`;
            }
        }

        return {
            template,
            email,
            context: { name, url, message: options?.message, userAgent: options?.userAgent }
        }
    }

    private async send(builder: MailerBuilder, subject: string) {
        await this.mailService.sendMail({
            to: builder.email,
            subject: subject,
            template: builder.template,
            context: builder.context,
            attachments: [
                {
                    filename: "brute-logo.png",
                    path: join(__dirname, "..", "mailer", "templates", "assets", "brute-logo.png"),
                    cid: "brute-logo"
                }
            ]
        });
    }

    async sendEmail(subject: MailerSubject, builder: MailerBuilder) {
        try {
            await this.send(builder, subject);
        } catch (error) {
            console.error("Mailer-Service | Error: ", error);
            throw error;
        }
    }
}
