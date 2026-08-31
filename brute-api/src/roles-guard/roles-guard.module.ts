import { Module } from '@nestjs/common';

import { RolesGuardService } from './roles-guard.service';

@Module({
  providers: [RolesGuardService],
  exports: [RolesGuardService]
})
export class RolesGuardModule {}
