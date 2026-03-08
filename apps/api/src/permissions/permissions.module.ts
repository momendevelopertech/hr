import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [NotificationsModule, AuditModule],
    providers: [PermissionsService],
    controllers: [PermissionsController],
    exports: [PermissionsService],
})
export class PermissionsModule { }
