import { Module } from '@nestjs/common';
import { LatenessController } from './lateness.controller';
import { LatenessService } from './lateness.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
    imports: [PrismaModule, PermissionsModule],
    controllers: [LatenessController],
    providers: [LatenessService],
})
export class LatenessModule { }
