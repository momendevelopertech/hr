import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { FormsService } from './forms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('forms')
@Controller('forms')
@UseGuards(JwtAuthGuard)
export class FormsController {
    constructor(private formsService: FormsService) { }

    // Admin: Create form
    @Post()
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    createForm(@Body() body: any, @Req() req: any) {
        return this.formsService.createForm(body, req.user.id);
    }

    // All: List forms (filtered by department)
    @Get()
    findAll(@Query('departmentId') departmentId?: string) {
        return this.formsService.findAll(departmentId);
    }

    @Get('submissions')
    getSubmissions(@Req() req: any) {
        return this.formsService.getSubmissions(req.user.id, req.user.role);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.formsService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    updateForm(@Param('id') id: string, @Body() body: any) {
        return this.formsService.updateForm(id, body);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    deleteForm(@Param('id') id: string) {
        return this.formsService.deleteForm(id);
    }

    // Employee: Submit a form
    @Post(':id/submit')
    submit(@Param('id') formId: string, @Body() body: any, @Req() req: any) {
        return this.formsService.submitForm(formId, req.user.id, body.data);
    }

    @Patch('submissions/:id/approve')
    @UseGuards(RolesGuard)
    @Roles('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    approveSubmission(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
        return this.formsService.updateSubmissionStatus(id, req.user.id, req.user.role, 'approve', comment);
    }

    @Patch('submissions/:id/reject')
    @UseGuards(RolesGuard)
    @Roles('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    rejectSubmission(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
        return this.formsService.updateSubmissionStatus(id, req.user.id, req.user.role, 'reject', comment);
    }

    @Patch('submissions/:id')
    updateSubmission(@Param('id') id: string, @Body('data') data: any, @Req() req: any) {
        return this.formsService.updateSubmission(id, req.user.id, req.user.role, data);
    }

    @Patch('submissions/:id/cancel')
    cancelSubmission(@Param('id') id: string, @Req() req: any) {
        return this.formsService.cancelSubmission(id, req.user.id, req.user.role);
    }

    @Post('submissions/:id/duplicate')
    duplicateSubmission(@Param('id') id: string, @Req() req: any) {
        return this.formsService.duplicateSubmission(id, req.user.id, req.user.role);
    }

    @Delete('submissions/:id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    deleteSubmission(@Param('id') id: string, @Req() req: any) {
        return this.formsService.deleteSubmission(id, req.user.id, req.user.role);
    }
}
