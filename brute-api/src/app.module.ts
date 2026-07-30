import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";

import { getEnvCors } from "./brute-api-config/env-config";

import { UserModule } from "./users/user.module";
import { CredentialsModule } from "./credentials/credentials.module";
import { TokensModule } from "./tokens/tokens.module";

import { MailerModule } from "./mailer/mailer.module";

import { AppService } from "./app.service";
import { AppController } from "./app.controller";

import { CredentialsGuardModule } from "./credentials-guard/credentials-guard.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    UserModule,
    CredentialsModule,
    TokensModule,

    ScheduleModule.forRoot(),
    MailerModule,

    CredentialsGuardModule,

    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: "mssql",
        host: process.env.DB_HOST,
        port: parseInt(getEnvCors("DB_PORT")),
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        entities: [],
        synchronize: false,
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      }),
    }),
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
