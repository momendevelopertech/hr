import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { LeavesModule } from './leaves/leaves.module';
import { PermissionsModule } from './permissions/permissions.module';
import { FormsModule } from './forms/forms.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotesModule } from './notes/notes.module';
import { PdfModule } from './pdf/pdf.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EventsGateway } from './events/events.gateway';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { RootController } from './root.controller';
import { SettingsModule } from './settings/settings.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '../../.env'],
        }),
        ThrottlerModule.forRoot([{
            ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
        }]),
        ScheduleModule.forRoot(),
        PrismaModule,
        AuthModule,
        UsersModule,
        DepartmentsModule,
        LeavesModule,
        PermissionsModule,
        FormsModule,
        NotesModule,
        NotificationsModule,
        PdfModule,
        ReportsModule,
        AuditModule,
        SettingsModule,
        CloudinaryModule,
        RedisModule,
        ChatModule,
    ],
    controllers: [RootController],
    providers: [EventsGateway],
})
export class AppModule { }
