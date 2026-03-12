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

    async findAll(userId: string, _role: string, filters?: { from?: string; to?: string }) {
        const where: any = {
            userId,
        };

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
