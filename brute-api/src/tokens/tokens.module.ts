import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "src/users/user.module";

import { Token } from "./entities/token-entity";

import { TokensService } from "./tokens.service";
import { TokensController } from "./tokens.controller";

@Module({
  imports: [
    UserModule,

    TypeOrmModule.forFeature([
      Token,
    ]),
  ],
  providers: [TokensService],
  controllers: [TokensController],

  exports: [TokensService],
})
export class TokensModule {}
