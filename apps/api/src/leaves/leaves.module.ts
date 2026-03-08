import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [NotificationsModule, AuditModule],
    providers: [LeavesService],
    controllers: [LeavesController],
    exports: [LeavesService],
})
export class LeavesModule { }
