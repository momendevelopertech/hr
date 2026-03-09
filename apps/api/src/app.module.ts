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
import { PdfModule } from './pdf/pdf.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EventsGateway } from './events/events.gateway';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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
        NotificationsModule,
        PdfModule,
        ReportsModule,
        AuditModule,
        CloudinaryModule,
        RedisModule,
        ChatModule,
    ],
    providers: [EventsGateway],
})
export class AppModule { }
