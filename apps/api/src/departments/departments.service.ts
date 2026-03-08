import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
    constructor(private prisma: PrismaService) { }

    async create(data: { name: string; nameAr: string; description?: string }) {
        return this.prisma.department.create({ data });
    }

    async findAll() {
        return this.prisma.department.findMany({
            include: {
                _count: { select: { employees: true, forms: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            include: { employees: { select: { id: true, fullName: true, role: true, jobTitle: true, profileImage: true } } },
        });
    }

    async update(id: string, data: { name?: string; nameAr?: string; description?: string }) {
        return this.prisma.department.update({ where: { id }, data });
    }

    async remove(id: string) {
        return this.prisma.department.delete({ where: { id } });
    }
}
