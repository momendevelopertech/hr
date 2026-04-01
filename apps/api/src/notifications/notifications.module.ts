import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PusherModule } from '../pusher/pusher.module';
import { WhatsAppService } from './whatsapp.service';

@Module({
    imports: [PusherModule],
    providers: [NotificationsService, WhatsAppService],
    controllers: [NotificationsController],
    exports: [NotificationsService, WhatsAppService],
})
export class NotificationsModule { }
