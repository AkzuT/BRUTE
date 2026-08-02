import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Token } from "./entities/token-entity"
import { TokenService } from "./tokens.service";
import { TokensController } from "./tokens.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Token])],
  providers: [TokenService],
  controllers: [TokensController],
  exports: [TokenService],
})
export class TokensModule {}
