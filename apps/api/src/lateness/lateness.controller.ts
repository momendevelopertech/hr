import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LatenessService } from './lateness.service';

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
    create(@Req() req: any, @Body() body: { date: string; minutesLate: number }) {
        return this.latenessService.createOrUpdate(req.user.id, body);
    }

    @Post(':id/convert')
    convert(@Req() req: any, @Param('id') id: string) {
        return this.latenessService.convertToPermission(req.user.id, id);
    }
}
