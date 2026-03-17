import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LatenessService } from './lateness.service';
import { CreateLatenessDto } from './dto/lateness.dto';

@Controller('lateness')
@UseGuards(JwtAuthGuard)
export class LatenessController {
    constructor(private latenessService: LatenessService) { }

    @Get()
    list(
        @Req() req: any,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.latenessService.findMine(req.user.id, { from, to });
    }

    @Post()
    create(@Req() req: any, @Body() body: CreateLatenessDto) {
        const targetUserId = body.userId || req.user.id;
        return this.latenessService.createOrUpdate(targetUserId, body, { id: req.user.id, role: req.user.role });
    }

    @Post(':id/convert')
    convert(@Req() req: any, @Param('id') id: string) {
        return this.latenessService.convertToPermission(req.user.id, id);
    }
}
