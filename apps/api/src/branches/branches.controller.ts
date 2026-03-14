import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BranchesService } from './branches.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';

@ApiTags('branches')
@Controller('branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
    constructor(private branchesService: BranchesService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    create(@Body() body: CreateBranchDto) {
        return this.branchesService.create(body);
    }

    @Get()
    findAll() {
        return this.branchesService.findAll();
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateBranchDto) {
        return this.branchesService.update(id, body);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.branchesService.remove(id);
    }
}
