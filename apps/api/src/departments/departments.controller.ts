import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('departments')
@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
    constructor(private deptService: DepartmentsService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    create(@Body() body: any) {
        return this.deptService.create(body);
    }

    @Get()
    findAll() {
        return this.deptService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.deptService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    update(@Param('id') id: string, @Body() body: any) {
        return this.deptService.update(id, body);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    remove(@Param('id') id: string) {
        return this.deptService.remove(id);
    }
}
