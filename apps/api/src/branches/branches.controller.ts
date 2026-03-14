import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BranchesService } from './branches.service';

@ApiTags('branches')
@Controller('branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
    constructor(private branchesService: BranchesService) { }

    @Get()
    findAll() {
        return this.branchesService.findAll();
    }
}
