import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
    constructor(private prisma: PrismaService) { }

    async create(data: { name: string; nameAr?: string; description?: string; branches?: number[] }) {
        const name = (data.name || '').trim();
        if (!name) throw new BadRequestException('Department name is required');

        const branches = (data.branches || [])
            .map((branchId) => (typeof branchId === 'string' ? parseInt(branchId, 10) : branchId))
            .filter((branchId) => Number.isFinite(branchId));
        if (!branches.length) {
            throw new BadRequestException('Department must be linked to at least one branch');
        }

        const existing = await this.prisma.department.findFirst({ where: { name } });
        if (existing) throw new BadRequestException('Department name already exists');

        const validBranches = await this.prisma.branch.count({ where: { id: { in: branches } } });
        if (validBranches !== branches.length) {
            throw new BadRequestException('Invalid branches selection');
        }

        try {
            return await this.prisma.department.create({
                data: {
                    name,
                    nameAr: data.nameAr?.trim() || name,
                    description: data.description,
                    branches: {
                        create: branches.map((branchId) => ({ branchId })),
                    },
                },
                include: {
                    branches: { include: { branch: true } },
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new BadRequestException('Department name already exists');
            }
            throw error;
        }
    }

    async findAll() {
        const [departments, branches, counts] = await Promise.all([
            this.prisma.department.findMany({
                include: {
                    branches: { include: { branch: true } },
                },
                orderBy: { name: 'asc' },
            }),
            this.prisma.branch.findMany({
                orderBy: { id: 'asc' },
            }),
            this.prisma.user.groupBy({
                by: ['departmentId', 'branchId'],
                where: {
                    departmentId: { not: null },
                    branchId: { not: null },
                },
                _count: { _all: true },
            }),
        ]);

        const countMap = new Map<string, number>();
        counts.forEach((entry) => {
            if (!entry.departmentId || !entry.branchId) return;
            countMap.set(`${entry.departmentId}:${entry.branchId}`, entry._count._all);
        });

        const alexBranch = branches.find((branch) => branch.name.toLowerCase().includes('alex'));
        const cairoBranch = branches.find((branch) => branch.name.toLowerCase().includes('cairo'));

        return departments.map((dept) => {
            const branchCounts = branches.map((branch) => ({
                branchId: branch.id,
                count: countMap.get(`${dept.id}:${branch.id}`) || 0,
            }));
            const totalEmployees = branchCounts.reduce((sum, item) => sum + item.count, 0);
            const alexandriaEmployees = alexBranch ? (countMap.get(`${dept.id}:${alexBranch.id}`) || 0) : 0;
            const cairoEmployees = cairoBranch ? (countMap.get(`${dept.id}:${cairoBranch.id}`) || 0) : 0;
            return {
                id: dept.id,
                name: dept.name,
                nameAr: dept.nameAr,
                description: dept.description,
                branches: dept.branches.map((link) => ({
                    id: link.branch.id,
                    name: link.branch.name,
                    nameAr: link.branch.nameAr,
                })),
                branchCounts,
                totalEmployees,
                total: totalEmployees,
                alexandria_employees: alexandriaEmployees,
                cairo_employees: cairoEmployees,
            };
        });
    }

    async findOne(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            include: {
                employees: { select: { id: true, fullName: true, role: true, jobTitle: true, profileImage: true } },
                branches: { include: { branch: true } },
            },
        });
    }

    async update(id: string, data: { name?: string; nameAr?: string; description?: string; branches?: number[] }) {
        const dept = await this.prisma.department.findUnique({ where: { id } });
        if (!dept) throw new NotFoundException('Department not found');

        const name = data.name?.trim();
        if (name) {
            const existing = await this.prisma.department.findFirst({ where: { name } });
            if (existing && existing.id !== id) {
                throw new BadRequestException('Department name already exists');
            }
        }

        if (data.branches) {
            const branches = data.branches
                .map((branchId) => (typeof branchId === 'string' ? parseInt(branchId, 10) : branchId))
                .filter((branchId) => Number.isFinite(branchId));
            if (!branches.length) {
                throw new BadRequestException('Department must be linked to at least one branch');
            }
            const validBranches = await this.prisma.branch.count({ where: { id: { in: branches } } });
            if (validBranches !== branches.length) {
                throw new BadRequestException('Invalid branches selection');
            }

            return this.prisma.$transaction(async (tx) => {
                await tx.departmentBranch.deleteMany({ where: { departmentId: id } });
                await tx.departmentBranch.createMany({
                    data: branches.map((branchId) => ({ departmentId: id, branchId })),
                    skipDuplicates: true,
                });
                return tx.department.update({
                    where: { id },
                    data: {
                        ...(name ? { name } : {}),
                        ...(data.nameAr ? { nameAr: data.nameAr } : {}),
                        ...(data.description !== undefined ? { description: data.description } : {}),
                    },
                    include: {
                        branches: { include: { branch: true } },
                    },
                });
            });
        }

        return this.prisma.department.update({
            where: { id },
            data: {
                ...(name ? { name } : {}),
                ...(data.nameAr ? { nameAr: data.nameAr } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
            },
            include: {
                branches: { include: { branch: true } },
            },
        });
    }

    async remove(id: string) {
        const dept = await this.prisma.department.findUnique({
            where: { id },
            select: { id: true, _count: { select: { employees: true } } },
        });
        if (!dept) throw new NotFoundException('Department not found');
        if ((dept._count?.employees || 0) > 0) {
            throw new BadRequestException('Cannot delete department because employees are assigned to it.');
        }
        return this.prisma.department.delete({ where: { id } });
    }
}
