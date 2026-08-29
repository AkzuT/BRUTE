import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { randomUUID } from "crypto";

import { User } from "./entities/user-entity";
import { UserPhone } from "./entities/user-phone-entity";
import { UserProfile } from "./entities/user-profile-entity";

import { UserService } from "./user.service";
import { UserController } from "./user.controller";

import { CredentialsModule } from "src/credentials/credentials.module";
import { TokensModule } from "src/tokens/tokens.module";
import { MailerModule } from "src/mailer/mailer.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserPhone,
      UserProfile,
    ]),
    CredentialsModule,
    TokensModule,
    MailerModule,
    MulterModule.register({
      storage: diskStorage({
        destination: "./profile-pictures",
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `@${randomUUID()}${ext}`);
        }
      })
    })
  ],
  providers: [UserService],
  controllers: [UserController],

  exports: [UserService],
})
export class UserModule {}
