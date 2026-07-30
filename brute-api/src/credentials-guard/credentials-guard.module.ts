import { Module } from "@nestjs/common";
import { CredentialsGuardService } from "./credentials-guard.service";

@Module({
  providers: [CredentialsGuardService],
})
export class CredentialsGuardModule {}
