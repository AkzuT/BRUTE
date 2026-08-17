import { Global, Module } from "@nestjs/common";

import { MailerModule as MailModule } from "@nestjs-modules/mailer";

import { ConfigService } from "@nestjs/config";

import { join } from "path";

import { HandlebarsAdapter } from "@nestjs-modules/mailer/adapters/handlebars.adapter";

import { MailerService } from "./mailer.service";
import { MailerController } from "./mailer.controller";

@Global()
@Module({
  imports: [
    MailModule.forRootAsync({
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get("MAILER_HOST"),
          port: parseInt(config.get("MAILER_PORT") ?? "587", 10),
          auth: {
            user: config.get("MAILER_USER"),
            pass: config.get("MAILER_PASS")
          }
        },
        defaults: {
          from: `"BRUTE - Soporte" <${config.get("MAILER_FROM")}>`
        },
        template: {
          dir: join(__dirname, "templates"),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true
          }
        },
        options: {
          partials: {
            dir: join(__dirname, "templates", "partials"),
            options: {
              strict: true,
            }
          }
        }
      }),
      inject: [ConfigService]
    })
  ],
  providers: [MailerService],
  controllers: [MailerController],

  exports: [MailerService]
})
export class MailerModule {}
