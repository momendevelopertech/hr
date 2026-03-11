import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PusherModule } from '../pusher/pusher.module';

@Module({
    imports: [PusherModule],
    providers: [ChatService],
    controllers: [ChatController],
})
export class ChatModule { }
