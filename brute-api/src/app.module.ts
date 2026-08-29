import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";

import { getEnvCors } from "./brute-api-config/env-config";

import { UserModule } from "./users/user.module";
import { User } from "./users/entities/user-entity";
import { UserPhone } from "./users/entities/user-phone-entity";
import { UserProfile } from "./users/entities/user-profile-entity";

import { CredentialsModule } from "./credentials/credentials.module";
import { Credential } from "./credentials/entities/credentials-entity";

import { TokensModule } from "./tokens/tokens.module";
import { Token } from "./tokens/entities/token-entity";

import { MailerModule } from "./mailer/mailer.module";

import { AppService } from "./app.service";
import { AppController } from "./app.controller";

import { AuthGuardModule } from "./authentication-guard/authentication-guard.module";
import { RolesGuardModule } from './roles-guard/roles-guard.module';

import { APP_GUARD } from "@nestjs/core";

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

    AuthGuardModule,
    RolesGuardModule,

    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: "mssql",
        host: process.env.DB_HOST,
        port: parseInt(getEnvCors("DB_PORT")),
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        entities: [
          User,
          UserPhone,
          UserProfile,

          Credential,
          Token
        ],
        synchronize: false,
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      }),
    }),
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuardModule
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuardModule
    }
  ],
})
export class AppModule {}
