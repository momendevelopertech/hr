import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.branch.findMany({
            orderBy: { id: 'asc' },
        });
    }
}
