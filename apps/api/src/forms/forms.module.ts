import { Module } from '@nestjs/common';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [NotificationsModule, AuditModule],
    providers: [FormsService],
    controllers: [FormsController],
    exports: [FormsService],
})
export class FormsModule { }
