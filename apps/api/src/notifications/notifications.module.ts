import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PusherModule } from '../pusher/pusher.module';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';

@Module({
    imports: [PusherModule],
    providers: [NotificationsService, WhatsAppService, EmailService],
    controllers: [NotificationsController],
    exports: [NotificationsService, WhatsAppService, EmailService],
})
export class NotificationsModule { }
