import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FormsService {
    constructor(
        private prisma: PrismaService,
        private auditService: AuditService,
        private notificationsService: NotificationsService,
    ) { }

    async createForm(data: {
        name: string;
        nameAr: string;
        description?: string;
        descriptionAr?: string;
        departmentId?: string;
        requiresManager?: boolean;
        requiresHr?: boolean;
        fields: Array<{
            label: string;
            labelAr: string;
            fieldType: any;
            isRequired?: boolean;
            placeholder?: string;
            options?: string[];
            order?: number;
        }>;
    }, createdById?: string) {
        const form = await this.prisma.dynamicForm.create({
            data: {
                name: data.name,
                nameAr: data.nameAr,
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

    async updateForm(id: string, data: any) {
        return this.prisma.dynamicForm.update({ where: { id }, data });
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

        const submission = await this.prisma.formSubmission.create({
            data: {
                formId,
                userId,
                data,
                status: 'PENDING',
            },
            include: { user: { include: { department: true } }, form: true },
        });

        await this.auditService.log({ userId, action: 'FORM_SUBMITTED', entity: 'FormSubmission', entityId: submission.id });

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
                    titleAr: `نموذج جديد: ${form.nameAr}`,
                    body: `${submission.user.fullName} submitted "${form.name}".`,
                    bodyAr: `قدّم ${submission.user.fullName} "${form.nameAr}".`,
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

        await this.notificationsService.createInApp({
            receiverId: submission.userId,
            type: action === 'approve' ? 'FORM_APPROVED' : 'FORM_REJECTED',
            title: action === 'approve' ? `Form Approved: ${submission.form.name}` : `Form Rejected: ${submission.form.name}`,
            titleAr: action === 'approve' ? `تمت الموافقة على النموذج` : `تم رفض النموذج`,
            body: comment || (action === 'approve' ? 'Approved.' : 'Rejected.'),
            bodyAr: comment || (action === 'approve' ? 'تمت الموافقة.' : 'تم الرفض.'),
        });

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
        if (role === 'EMPLOYEE') {
            if (submission.userId !== actorId) throw new ForbiddenException();
            if (submission.status !== 'PENDING') throw new BadRequestException('Can only cancel pending submissions');
        }
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

        return this.prisma.formSubmission.create({
            data: {
                formId: submission.formId,
                userId: submission.userId,
                data: submission.data,
                status: 'PENDING',
            },
        });
    }
}
