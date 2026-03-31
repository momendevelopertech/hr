import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as csurf from 'csurf';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { getCookieSettings } from '../src/shared/cookie-settings';

const shouldRun = !!process.env.TEST_DATABASE_URL || !!process.env.DATABASE_URL;

jest.setTimeout(180000);

const setupApp = (app: INestApplication) => {
    app.use(cookieParser(process.env.CSRF_SECRET || 'test-csrf-secret'));
    const { sameSite, secure, domain, path } = getCookieSettings();
    const csrfProtection = csurf({
        cookie: {
            key: 'csrf_secret',
            httpOnly: true,
            secure,
            sameSite,
            path,
            ...(domain ? { domain } : {}),
        },
    });

    app.use((req, res, next) => {
        const method = (req.method || '').toUpperCase();
        const reqPath = req.path || '';
        const shouldSkipCsrf =
            method === 'POST' &&
            (reqPath === '/api/auth/refresh' || reqPath === '/api/auth/logout');

        if (shouldSkipCsrf) {
            return next();
        }

        return csrfProtection(req, res, next);
    });

    app.use((err, _req, res, next) => {
        if (err && err.code === 'EBADCSRFTOKEN') {
            return res.status(403).json({ message: 'Invalid CSRF token' });
        }
        return next(err);
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            stopAtFirstError: true,
        }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
};

const getCsrf = async (agent: request.SuperAgentTest) => {
    const res = await agent.get('/api/auth/csrf');
    return res.body.csrfToken as string;
};

const createTestUser = async (prisma: PrismaService, data: {
    email: string;
    username: string;
    fullName: string;
    role: any;
    governorate: any;
    branchId?: number;
    departmentId?: string | null;
    password: string;
    employeeNumber: string;
}) => {
    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
        data: {
            employeeNumber: data.employeeNumber,
            username: data.username,
            fullName: data.fullName,
            email: data.email,
            passwordHash,
            role: data.role,
            governorate: data.governorate,
            branchId: data.branchId,
            departmentId: data.departmentId ?? null,
            phone: '01000000123',
            jobTitle: 'Employee',
            jobTitleAr: 'موظف',
            fingerprintId: data.employeeNumber,
            mustChangePass: false,
            isActive: true,
        },
    });
};

(shouldRun ? describe : describe.skip)('Auth and Workflow E2E', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    const password = 'Test@12345';
    const testPrefix = `e2e-${Date.now()}`;
    const createdUserIds: string[] = [];

    const users: any = {};

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'test-csrf-secret';
        process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
        if (process.env.TEST_DATABASE_URL) {
            process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        }

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        setupApp(app);
        await app.init();
        prisma = moduleRef.get(PrismaService);

        const branch = await prisma.branch.upsert({
            where: { name: 'Cairo' },
            update: { nameAr: 'القاهرة' },
            create: { name: 'Cairo', nameAr: 'القاهرة' },
        });
        const dept = await prisma.department.upsert({
            where: { name: 'ERC' },
            update: { nameAr: 'ERC' },
            create: { name: 'ERC', nameAr: 'ERC', description: 'ERC Department' },
        });
        await prisma.departmentBranch.createMany({
            data: [{ departmentId: dept.id, branchId: branch.id }],
            skipDuplicates: true,
        });

        users.employee = await createTestUser(prisma, {
            email: `${testPrefix}-employee@sphinx.com`,
            username: `${testPrefix}-emp`,
            fullName: 'E2E Employee',
            role: 'EMPLOYEE',
            governorate: 'CAIRO',
            branchId: branch.id,
            departmentId: dept.id,
            password,
            employeeNumber: `EMP-${Date.now()}-E`,
        });
        users.secretary = await createTestUser(prisma, {
            email: `${testPrefix}-sec@sphinx.com`,
            username: `${testPrefix}-sec`,
            fullName: 'E2E Secretary',
            role: 'BRANCH_SECRETARY',
            governorate: 'CAIRO',
            branchId: branch.id,
            departmentId: null,
            password,
            employeeNumber: `EMP-${Date.now()}-S`,
        });
        users.manager = await createTestUser(prisma, {
            email: `${testPrefix}-mgr@sphinx.com`,
            username: `${testPrefix}-mgr`,
            fullName: 'E2E Manager',
            role: 'MANAGER',
            governorate: 'CAIRO',
            branchId: branch.id,
            departmentId: dept.id,
            password,
            employeeNumber: `EMP-${Date.now()}-M`,
        });
        users.hrAdmin = await createTestUser(prisma, {
            email: `${testPrefix}-hr@sphinx.com`,
            username: `${testPrefix}-hr`,
            fullName: 'E2E HR Admin',
            role: 'HR_ADMIN',
            governorate: 'CAIRO',
            branchId: branch.id,
            departmentId: null,
            password,
            employeeNumber: `EMP-${Date.now()}-H`,
        });

        createdUserIds.push(users.employee.id, users.secretary.id, users.manager.id, users.hrAdmin.id);
    }, 30000);

    afterAll(async () => {
        if (createdUserIds.length) {
            await prisma.permissionRequest.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.leaveRequest.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.permissionCycle.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.leaveBalance.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.notification.deleteMany({
                where: {
                    OR: [{ receiverId: { in: createdUserIds } }, { senderId: { in: createdUserIds } }],
                },
            });
            await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.note.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
        }

        await app.close();
    });

    it('logs in and refreshes a session with IP/UA binding', async () => {
        const agent = request.agent(app.getHttpServer());
        const csrf = await getCsrf(agent);

        const loginRes = await agent
            .post('/api/auth/login')
            .set('X-CSRF-Token', csrf)
            .set('User-Agent', 'jest-agent')
            .send({ identifier: users.employee.email, password });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body?.user?.email).toBe(users.employee.email);

        const refreshRes = await agent
            .post('/api/auth/refresh')
            .set('User-Agent', 'jest-agent');
        expect(refreshRes.status).toBe(200);

        const mismatch = await agent
            .post('/api/auth/refresh')
            .set('User-Agent', 'jest-agent-mismatch');
        expect([401, 403]).toContain(mismatch.status);
    }, 60000);

    it('processes leave and permission workflows end-to-end', async () => {
        const employeeAgent = request.agent(app.getHttpServer());
        const secretaryAgent = request.agent(app.getHttpServer());
        const managerAgent = request.agent(app.getHttpServer());
        const hrAgent = request.agent(app.getHttpServer());

        const employeeCsrf = await getCsrf(employeeAgent);
        const secretaryCsrf = await getCsrf(secretaryAgent);
        const managerCsrf = await getCsrf(managerAgent);
        const hrCsrf = await getCsrf(hrAgent);

        await employeeAgent.post('/api/auth/login').set('X-CSRF-Token', employeeCsrf).send({
            identifier: users.employee.email,
            password,
        });
        await secretaryAgent.post('/api/auth/login').set('X-CSRF-Token', secretaryCsrf).send({
            identifier: users.secretary.email,
            password,
        });
        await managerAgent.post('/api/auth/login').set('X-CSRF-Token', managerCsrf).send({
            identifier: users.manager.email,
            password,
        });
        await hrAgent.post('/api/auth/login').set('X-CSRF-Token', hrCsrf).send({
            identifier: users.hrAdmin.email,
            password,
        });

        const today = new Date().toISOString().slice(0, 10);
        const leaveRes = await employeeAgent.post('/api/leaves').set('X-CSRF-Token', employeeCsrf).send({
            leaveType: 'ANNUAL',
            startDate: today,
            endDate: today,
            reason: 'E2E test leave',
        });
        expect([200, 201]).toContain(leaveRes.status);
        const leaveId = leaveRes.body?.id;
        expect(leaveId).toBeTruthy();

        await secretaryAgent.patch(`/api/leaves/${leaveId}/approve`).set('X-CSRF-Token', secretaryCsrf).send({
            comment: 'Verified',
        });
        await managerAgent.patch(`/api/leaves/${leaveId}/approve`).set('X-CSRF-Token', managerCsrf).send({
            comment: 'Manager approved',
        });
        await hrAgent.patch(`/api/leaves/${leaveId}/approve`).set('X-CSRF-Token', hrCsrf).send({
            comment: 'HR approved',
        });

        const leaveFinal = await hrAgent.get(`/api/leaves/${leaveId}`);
        expect(leaveFinal.body?.status).toBe('HR_APPROVED');

        const permRes = await employeeAgent.post('/api/permissions').set('X-CSRF-Token', employeeCsrf).send({
            permissionType: 'PERSONAL',
            requestDate: today,
            arrivalTime: '11:00',
            leaveTime: '12:00',
            reason: 'E2E permission',
        });
        expect([200, 201]).toContain(permRes.status);
        const permId = permRes.body?.id;
        expect(permId).toBeTruthy();

        await secretaryAgent.patch(`/api/permissions/${permId}/approve`).set('X-CSRF-Token', secretaryCsrf).send({
            comment: 'Verified',
        });
        await managerAgent.patch(`/api/permissions/${permId}/approve`).set('X-CSRF-Token', managerCsrf).send({
            comment: 'Manager approved',
        });
        await hrAgent.patch(`/api/permissions/${permId}/approve`).set('X-CSRF-Token', hrCsrf).send({
            comment: 'HR approved',
        });

        const permFinal = await hrAgent.get(`/api/permissions/${permId}`);
        expect(permFinal.body?.status).toBe('HR_APPROVED');
    }, 120000);

    it('self-registers an employee in sandbox mode and only applies mode changes to future requests', async () => {
        const agent = request.agent(app.getHttpServer());
        const csrf = await getCsrf(agent);
        const optionsRes = await agent.get('/api/auth/registration-options');

        expect(optionsRes.status).toBe(200);
        expect(Array.isArray(optionsRes.body?.branches)).toBe(true);
        expect(Array.isArray(optionsRes.body?.departments)).toBe(true);

        const email = `${testPrefix}-sandbox-${Date.now()}@sphinx.com`;
        const registerRes = await agent
            .post('/api/auth/register')
            .set('X-CSRF-Token', csrf)
            .send({
                fullName: 'Sandbox Employee',
                fullNameAr: 'موظف تجريبي',
                email,
                phone: '01000000999',
                password,
                branchId: users.employee.branchId,
                departmentId: users.employee.departmentId,
                jobTitle: 'QA Tester',
                jobTitleAr: 'مختبر جودة',
            });

        expect(registerRes.status).toBe(201);
        expect(registerRes.body?.user?.email).toBe(email);
        expect(registerRes.body?.user?.role).toBe('EMPLOYEE');
        expect(registerRes.body?.user?.workflowMode).toBe('SANDBOX');
        expect(registerRes.body?.user?.employeeNumber).toBeTruthy();

        const sandboxUserId = registerRes.body?.user?.id as string;
        createdUserIds.push(sandboxUserId);

        const sandboxCsrf = await getCsrf(agent);
        const today = new Date();
        const startDate = today.toISOString().slice(0, 10);
        const nextDay = new Date(today);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDate = nextDay.toISOString().slice(0, 10);

        const sandboxLeave = await agent
            .post('/api/leaves')
            .set('X-CSRF-Token', sandboxCsrf)
            .send({
                leaveType: 'ANNUAL',
                startDate,
                endDate: startDate,
                reason: 'Sandbox auto-approval check',
            });

        expect([200, 201]).toContain(sandboxLeave.status);
        expect(sandboxLeave.body?.status).toBe('HR_APPROVED');

        const switchRes = await agent
            .patch('/api/auth/workflow-mode')
            .set('X-CSRF-Token', sandboxCsrf)
            .send({ workflowMode: 'APPROVAL_WORKFLOW' });

        expect(switchRes.status).toBe(200);
        expect(switchRes.body?.user?.workflowMode).toBe('APPROVAL_WORKFLOW');

        const firstLeaveAfterSwitch = await agent.get(`/api/leaves/${sandboxLeave.body?.id}`);
        expect(firstLeaveAfterSwitch.status).toBe(200);
        expect(firstLeaveAfterSwitch.body?.status).toBe('HR_APPROVED');

        const workflowLeave = await agent
            .post('/api/leaves')
            .set('X-CSRF-Token', sandboxCsrf)
            .send({
                leaveType: 'ANNUAL',
                startDate: nextDate,
                endDate: nextDate,
                reason: 'Workflow mode should stay pending',
            });

        expect([200, 201]).toContain(workflowLeave.status);
        expect(workflowLeave.body?.status).toBe('PENDING');
    }, 120000);
});
