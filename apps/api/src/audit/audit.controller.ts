import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'HR_ADMIN')
export class AuditController {
    constructor(private auditService: AuditService) { }

    @Get()
    getLogs(@Query('userId') userId?: string, @Query('action') action?: any) {
        return this.auditService.getLogs({ userId, action });
    }
}
