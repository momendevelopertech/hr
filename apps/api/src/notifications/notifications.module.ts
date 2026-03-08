import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EventsModule } from '../events/events.module';

@Module({
    imports: [forwardRef(() => EventsModule)],
    providers: [NotificationsService],
    controllers: [NotificationsController],
    exports: [NotificationsService],
})
export class NotificationsModule { }
