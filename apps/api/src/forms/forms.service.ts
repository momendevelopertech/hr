import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFormDto, UpdateFormDto } from './dto/forms.dto';

@Injectable()
export class FormsService {
    constructor(
        private prisma: PrismaService,
        private auditService: AuditService,
        private notificationsService: NotificationsService,
    ) { }

    async createForm(data: CreateFormDto, createdById?: string) {
        const form = await this.prisma.dynamicForm.create({
            data: {
                name: data.name,
                nameAr: data.nameAr || data.name,
                description: data.description,
                descriptionAr: data.descriptionAr,
                departmentId: data.departmentId,
                requiresManager: data.requiresManager ?? true,
                requiresHr: data.requiresHr ?? true,
                fields: {
                    create: data.fields.map((f, i) => ({
                        label: f.label,
                        labelAr: f.labelAr,
                        fieldType: f.fieldType,
                        isRequired: f.isRequired ?? false,
                        placeholder: f.placeholder,
                        options: f.options,
                        order: f.order ?? i,
                    })),
                },
            },
            include: { fields: { orderBy: { order: 'asc' } } },
        });

        await this.auditService.log({ userId: createdById, action: 'FORM_CREATED', entity: 'DynamicForm', entityId: form.id });
        return form;
    }

    async findAll(departmentId?: string) {
        return this.prisma.dynamicForm.findMany({
            where: {
                isActive: true,
                ...(departmentId && { OR: [{ departmentId }, { departmentId: null }] }),
            },
            include: { fields: { orderBy: { order: 'asc' } }, department: true },
        });
    }

    async findOne(id: string) {
        return this.prisma.dynamicForm.findUnique({
            where: { id },
            include: { fields: { orderBy: { order: 'asc' } } },
        });
    }

    async updateForm(id: string, data: UpdateFormDto) {
        const updateData: any = {
            ...(data.name ? { name: data.name } : {}),
            ...(data.nameAr ? { nameAr: data.nameAr } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.descriptionAr !== undefined ? { descriptionAr: data.descriptionAr } : {}),
            ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
            ...(data.requiresManager !== undefined ? { requiresManager: data.requiresManager } : {}),
            ...(data.requiresHr !== undefined ? { requiresHr: data.requiresHr } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        };

        return this.prisma.dynamicForm.update({
            where: { id },
            data: updateData,
            include: { fields: { orderBy: { order: 'asc' } } },
        });
    }

    async deleteForm(id: string) {
        return this.prisma.dynamicForm.update({ where: { id }, data: { isActive: false } });
    }

    async submitForm(formId: string, userId: string, data: Record<string, any>) {
        const form = await this.prisma.dynamicForm.findUnique({
            where: { id: formId },
            include: { fields: true },
        });
        if (!form) throw new Error('Form not found');

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                workflowMode: true,
            },
        });
        if (!user) throw new NotFoundException('User not found');
        const isSandbox = user.workflowMode === 'SANDBOX';

        const submission = await this.prisma.formSubmission.create({
            data: {
                formId,
                userId,
                data,
                status: isSandbox ? 'HR_APPROVED' : 'PENDING',
                ...(isSandbox ? { approvedByHrAt: new Date() } : {}),
            },
            include: { user: { include: { department: true } }, form: true },
        });

        await this.auditService.log({
            userId,
            action: 'FORM_SUBMITTED',
            entity: 'FormSubmission',
            entityId: submission.id,
            details: isSandbox ? { autoApproved: true, workflowMode: 'SANDBOX' } : undefined,
        });

        if (isSandbox) {
            await this.auditService.log({
                userId,
                action: 'FORM_APPROVED',
                entity: 'FormSubmission',
                entityId: submission.id,
                details: { autoApproved: true, workflowMode: 'SANDBOX' },
            });

            await this.notificationsService.notifyFormAction(submission, 'approved', {
                body: 'Your form was auto-approved in Sandbox Mode.',
                bodyAr: 'تم اعتماد النموذج تلقائيًا في وضع التجربة.',
            });
            await this.notificationsService.emitRealtimeToUsers([submission.userId], {
                type: 'REQUEST_UPDATED',
                requestType: 'form',
                requestId: submission.id,
            });
            return submission;
        }

        await this.notificationsService.notifyFormAction(submission, 'submitted');

        // Notify managers
        if (submission.user.departmentId) {
            const managers = await this.prisma.user.findMany({
                where: {
                    departmentId: submission.user.departmentId,
                    role: { in: ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'] },
                },
            });
            for (const mgr of managers) {
                await this.notificationsService.createInApp({
                    receiverId: mgr.id,
                    senderId: userId,
                    type: 'FORM_SUBMISSION',
                    title: `New Form: ${form.name}`,
                    titleAr: `نموذج جديد: ${form.nameAr || form.name}`,
                    body: `${submission.user.fullName} submitted "${form.name}".`,
                    bodyAr: `قدّم ${submission.user.fullNameAr || submission.user.fullName} "${form.nameAr || form.name}".`,
                    metadata: { submissionId: submission.id, formId },
                });
            }
        }

        return submission;
    }

    async getSubmissions(userId: string, role: string) {
        const where: any = {};
        if (role === 'EMPLOYEE') where.userId = userId;
        else if (role === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: userId } });
            const employees = await this.prisma.user.findMany({ where: { departmentId: manager.departmentId }, select: { id: true } });
            where.userId = { in: employees.map((e) => e.id) };
        } else if (role === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: userId } });
            if (secretary?.governorate) {
                const employees = await this.prisma.user.findMany({ where: { governorate: secretary.governorate }, select: { id: true } });
                where.userId = { in: employees.map((e) => e.id) };
            }
        }
        if (!where.userId && !(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) {
            where.userId = userId;
        }

        return this.prisma.formSubmission.findMany({
            where,
            include: {
                form: { select: { name: true, nameAr: true } },
                user: { select: { fullName: true, fullNameAr: true, employeeNumber: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateSubmissionStatus(id: string, actorId: string, role: string, action: 'approve' | 'reject', comment?: string) {
        let newStatus: any;
        const updateData: any = {};

        if (role === 'MANAGER') {
            newStatus = action === 'approve' ? 'MANAGER_APPROVED' : 'REJECTED';
            updateData.managerComment = comment;
            if (action === 'approve') { updateData.approvedByMgrId = actorId; updateData.approvedByMgrAt = new Date(); }
        } else {
            newStatus = action === 'approve' ? 'HR_APPROVED' : 'REJECTED';
            updateData.hrComment = comment;
            if (action === 'approve') { updateData.approvedByHrId = actorId; updateData.approvedByHrAt = new Date(); }
        }

        updateData.status = newStatus;
        const submission = await this.prisma.formSubmission.update({ where: { id }, data: updateData, include: { user: true, form: true } });

        await this.auditService.log({
            userId: actorId,
            action: action === 'approve' ? 'FORM_APPROVED' : 'FORM_REJECTED',
            entity: 'FormSubmission',
            entityId: id,
        });

        if (action === 'reject') {
            await this.notificationsService.notifyFormAction(submission, 'rejected', { comment });
        } else if (role === 'MANAGER') {
            await this.notificationsService.notifyFormAction(submission, 'managerApproved', { comment });
        } else {
            await this.notificationsService.notifyFormAction(submission, 'approved', { comment });
        }

        return submission;
    }

    async updateSubmission(id: string, actorId: string, role: string, data: Record<string, any>) {
        const submission = await this.prisma.formSubmission.findUnique({ where: { id } });
        if (!submission) throw new NotFoundException('Not found');
        if (role === 'EMPLOYEE') {
            if (submission.userId !== actorId) throw new ForbiddenException();
            if (submission.status !== 'PENDING') throw new BadRequestException('Can only edit pending submissions');
        }

        const updated = await this.prisma.formSubmission.update({
            where: { id },
            data: { data },
        });

        await this.auditService.log({ userId: actorId, action: 'REQUEST_EDITED', entity: 'FormSubmission', entityId: id });
        return updated;
    }

    async cancelSubmission(id: string, actorId: string, role: string) {
        const submission = await this.prisma.formSubmission.findUnique({ where: { id } });
        if (!submission) throw new NotFoundException('Not found');
        if (submission.userId !== actorId) throw new ForbiddenException('Only submission owner can cancel');
        if (submission.status !== 'PENDING') throw new BadRequestException('Can only cancel pending submissions');
        await this.prisma.formSubmission.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.auditService.log({ userId: actorId, action: 'REQUEST_EDITED', entity: 'FormSubmission', entityId: id });
        return { message: 'Cancelled' };
    }

    async deleteSubmission(id: string, actorId: string, role: string) {
        if (!(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) throw new ForbiddenException();
        await this.prisma.formSubmission.delete({ where: { id } });
        await this.auditService.log({ userId: actorId, action: 'REQUEST_DELETED', entity: 'FormSubmission', entityId: id });
        return { message: 'Deleted' };
    }

    async duplicateSubmission(id: string, actorId: string, role: string) {
        const submission = await this.prisma.formSubmission.findUnique({ where: { id } });
        if (!submission) throw new NotFoundException('Not found');
        if (role === 'EMPLOYEE' && submission.userId !== actorId) throw new ForbiddenException();

        return this.submitForm(submission.formId, submission.userId, submission.data as Record<string, any>);
    }
}
