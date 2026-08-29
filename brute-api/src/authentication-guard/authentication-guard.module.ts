import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Token } from "src/tokens/entities/token-entity";

import { AuthenticationGuardService } from "./authentication-guard.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Token
    ])
  ],
  providers: [AuthenticationGuardService],
  exports: [AuthenticationGuardService]
})
export class AuthGuardModule {}
