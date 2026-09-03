import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource } from "typeorm";

@Injectable()
export class SchedulerService implements OnModuleInit {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(private dataSource: DataSource) {}

    async onModuleInit() {
        this.logger.log("Scheduler-Service | Verifying expired PENDING credentials.");
        await this.cleanupExpiredPendingCredentials();
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleMidnightCron() {
        this.logger.log("Scheduler-Service | Executing daily cleanup process.");
        await this.cleanupExpiredPendingCredentials();
    }

    private async cleanupExpiredPendingCredentials() {
        try {
            await this.dataSource.query("EXEC [dbo].[PR_Cleanup_Expired_Pending_Credentials]");
            this.logger.log("Scheduler-Service | [PR_Cleanup_Expired_Pending_Credentials] executed.");
        } catch (error){
            this.logger.error("Scheduler-Service | [PR_Cleanup_Expired_Pending_Credentials] ran into an error", error);
        }
    }
}
