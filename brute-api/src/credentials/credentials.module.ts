import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "src/users/user.module";
import { TokensModule } from "src/tokens/tokens.module";
import { MailerModule } from "src/mailer/mailer.module";

import { Credential } from "./entities/credentials-entity";

import { CredentialsService } from "./credentials.service";
import { CredentialsController } from "./credentials.controller";

@Module({
  imports: [
    UserModule,
    TokensModule,
    MailerModule,

    TypeOrmModule.forFeature([
      Credential,
    ]),
  ],
  providers: [CredentialsService],
  controllers: [CredentialsController],

  exports: [CredentialsService],
})
export class CredentialsModule {}
