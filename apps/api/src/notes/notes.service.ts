import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotesService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, data: { date: string; title: string; body?: string }) {
        return this.prisma.note.create({
            data: {
                userId,
                date: new Date(data.date),
                title: data.title || 'Note',
                body: data.body || '',
            },
            include: {
                user: { select: { id: true, fullName: true, fullNameAr: true, employeeNumber: true, department: true } },
            },
        });
    }

    async findAll(userId: string, role: string, filters?: { from?: string; to?: string }) {
        const where: any = {};

        if (role === 'EMPLOYEE') {
            where.userId = userId;
        } else if (role === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: userId } });
            const employees = await this.prisma.user.findMany({
                where: { departmentId: manager?.departmentId || undefined },
                select: { id: true },
            });
            where.userId = { in: employees.map((e) => e.id) };
        } else if (role === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: userId } });
            if (secretary?.governorate) {
                const employees = await this.prisma.user.findMany({
                    where: { governorate: secretary.governorate },
                    select: { id: true },
                });
                where.userId = { in: employees.map((e) => e.id) };
            }
        }

        if (filters?.from || filters?.to) {
            where.date = {
                ...(filters?.from ? { gte: new Date(filters.from) } : {}),
                ...(filters?.to ? { lte: new Date(filters.to) } : {}),
            };
        }

        return this.prisma.note.findMany({
            where,
            include: {
                user: { select: { id: true, fullName: true, fullNameAr: true, employeeNumber: true, department: true } },
            },
            orderBy: { date: 'desc' },
        });
    }
}
