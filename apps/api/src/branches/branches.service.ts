import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';

@Injectable()
export class BranchesService {
    constructor(private prisma: PrismaService) { }

    async create(data: CreateBranchDto) {
        const name = (data.name || '').trim();
        if (!name) throw new BadRequestException('Branch name is required');

        const existing = await this.prisma.branch.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
        });
        if (existing) throw new BadRequestException('Branch name already exists');

        return this.prisma.branch.create({
            data: {
                name,
                nameAr: data.nameAr?.trim() || null,
            },
        });
    }

    async findAll() {
        const branches = await this.prisma.branch.findMany({
            orderBy: { id: 'asc' },
            include: {
                _count: { select: { departments: true, employees: true } },
            },
        });

        return branches.map(({ _count, ...branch }) => ({
            ...branch,
            departmentCount: _count.departments,
            employeeCount: _count.employees,
        }));
    }

    async update(id: number, data: UpdateBranchDto) {
        const branch = await this.prisma.branch.findUnique({
            where: { id },
        });
        if (!branch) throw new NotFoundException('Branch not found');

        const updates: { name?: string; nameAr?: string | null } = {};

        if (data.name !== undefined) {
            const name = data.name.trim();
            if (!name) throw new BadRequestException('Branch name is required');
            const existing = await this.prisma.branch.findFirst({
                where: {
                    name: { equals: name, mode: 'insensitive' },
                    NOT: { id },
                },
            });
            if (existing) throw new BadRequestException('Branch name already exists');
            updates.name = name;
        }

        if (data.nameAr !== undefined) {
            const nameAr = data.nameAr.trim();
            updates.nameAr = nameAr || null;
        }

        if (!Object.keys(updates).length) {
            return branch;
        }

        return this.prisma.branch.update({
            where: { id },
            data: updates,
        });
    }

    async remove(id: number) {
        const branch = await this.prisma.branch.findUnique({
            where: { id },
            include: {
                _count: { select: { departments: true, employees: true } },
            },
        });
        if (!branch) throw new NotFoundException('Branch not found');
        if (branch._count.departments > 0) {
            throw new BadRequestException('Cannot delete branch because departments are linked to it.');
        }
        if (branch._count.employees > 0) {
            throw new BadRequestException('Cannot delete branch because employees are assigned to it.');
        }
        return this.prisma.branch.delete({ where: { id } });
    }
}
