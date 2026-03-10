import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotesService } from './notes.service';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
    constructor(private notesService: NotesService) { }

    @Get()
    findAll(
        @Req() req: any,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.notesService.findAll(req.user.id, req.user.role, { from, to });
    }

    @Post()
    create(@Req() req: any, @Body() body: any) {
        return this.notesService.create(req.user.id, body);
    }
}
