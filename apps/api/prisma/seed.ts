import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding SPHINX HR database...');

    const departmentsData = [
        {
            name: 'ERC',
            nameAr: 'ERC',
            description: 'ERC Department',
        },
        {
            name: 'SPHINX',
            nameAr: 'SPHINX',
            description: 'SPHINX Department',
        },
    ];

    const departments = await Promise.all(
        departmentsData.map((dept) =>
            prisma.department.upsert({
                where: { name: dept.name },
                update: {
                    nameAr: dept.nameAr,
                    description: dept.description,
                },
                create: {
                    name: dept.name,
                    nameAr: dept.nameAr,
                    description: dept.description,
                },
            }),
        ),
    );

    const ercDept = departments.find((d) => d.name === 'ERC');
    const sphinxDept = departments.find((d) => d.name === 'SPHINX');

    const superAdminPass = await bcrypt.hash('Admin@123456', 12);
    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0001',
            fullName: 'Super Admin',
            fullNameAr: 'Super Admin',
            email: 'superadmin@sphinx.com',
            phone: '+201000000001',
            passwordHash: superAdminPass,
            role: 'SUPER_ADMIN',
            governorate: 'CAIRO',
            departmentId: sphinxDept?.id,
            jobTitle: 'System Administrator',
            jobTitleAr: 'System Administrator',
            mustChangePass: false,
            isActive: true,
        },
    });

    const hrAdminPass = await bcrypt.hash('HrAdmin@123', 12);
    const hrAdmin = await prisma.user.upsert({
        where: { email: 'hradmin@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0002',
            fullName: 'Sarah HR Manager',
            fullNameAr: 'Sarah HR Manager',
            email: 'hradmin@sphinx.com',
            phone: '+201000000002',
            passwordHash: hrAdminPass,
            role: 'HR_ADMIN',
            governorate: 'CAIRO',
            departmentId: ercDept?.id,
            jobTitle: 'HR Manager',
            jobTitleAr: 'HR Manager',
            mustChangePass: false,
            isActive: true,
        },
    });

    const managerPass = await bcrypt.hash('Manager@123', 12);
    const managers = await Promise.all([
        prisma.user.upsert({
            where: { email: 'erc.alex.manager@sphinx.com' },
            update: {},
            create: {
                employeeNumber: 'EMP-0003',
                fullName: 'Mahmoud ERC Manager',
                fullNameAr: 'Mahmoud ERC Manager',
                email: 'erc.alex.manager@sphinx.com',
                phone: '+201000000003',
                passwordHash: managerPass,
                role: 'MANAGER',
                governorate: 'ALEXANDRIA',
                departmentId: ercDept?.id,
                jobTitle: 'ERC Department Manager',
                jobTitleAr: 'ERC Department Manager',
                mustChangePass: false,
                isActive: true,
            },
        }),
        prisma.user.upsert({
            where: { email: 'sphinx.alex.manager@sphinx.com' },
            update: {},
            create: {
                employeeNumber: 'EMP-0004',
                fullName: 'Nadia SPHINX Manager',
                fullNameAr: 'Nadia SPHINX Manager',
                email: 'sphinx.alex.manager@sphinx.com',
                phone: '+201000000004',
                passwordHash: managerPass,
                role: 'MANAGER',
                governorate: 'ALEXANDRIA',
                departmentId: sphinxDept?.id,
                jobTitle: 'SPHINX Department Manager',
                jobTitleAr: 'SPHINX Department Manager',
                mustChangePass: false,
                isActive: true,
            },
        }),
        prisma.user.upsert({
            where: { email: 'erc.cairo.manager@sphinx.com' },
            update: {},
            create: {
                employeeNumber: 'EMP-0005',
                fullName: 'Hassan ERC Manager',
                fullNameAr: 'Hassan ERC Manager',
                email: 'erc.cairo.manager@sphinx.com',
                phone: '+201000000005',
                passwordHash: managerPass,
                role: 'MANAGER',
                governorate: 'CAIRO',
                departmentId: ercDept?.id,
                jobTitle: 'ERC Department Manager',
                jobTitleAr: 'ERC Department Manager',
                mustChangePass: false,
                isActive: true,
            },
        }),
        prisma.user.upsert({
            where: { email: 'sphinx.cairo.manager@sphinx.com' },
            update: {},
            create: {
                employeeNumber: 'EMP-0006',
                fullName: 'Laila SPHINX Manager',
                fullNameAr: 'Laila SPHINX Manager',
                email: 'sphinx.cairo.manager@sphinx.com',
                phone: '+201000000006',
                passwordHash: managerPass,
                role: 'MANAGER',
                governorate: 'CAIRO',
                departmentId: sphinxDept?.id,
                jobTitle: 'SPHINX Department Manager',
                jobTitleAr: 'SPHINX Department Manager',
                mustChangePass: false,
                isActive: true,
            },
        }),
    ]);

    const [alexErcManager, alexSphinxManager, cairoErcManager, cairoSphinxManager] = managers;

    await Promise.all([
        ercDept?.id
            ? prisma.department.update({ where: { id: ercDept.id }, data: { managerId: cairoErcManager.id } })
            : Promise.resolve(),
        sphinxDept?.id
            ? prisma.department.update({ where: { id: sphinxDept.id }, data: { managerId: cairoSphinxManager.id } })
            : Promise.resolve(),
    ]);

    const secretaryPass = await bcrypt.hash('Secretary@123', 12);
    const [alexSecretary, cairoSecretary] = await Promise.all([
        prisma.user.upsert({
            where: { email: 'alex.secretary@sphinx.com' },
            update: {},
            create: {
                employeeNumber: 'EMP-0007',
                fullName: 'Mona Alexandria Secretary',
                fullNameAr: 'Mona Alexandria Secretary',
                email: 'alex.secretary@sphinx.com',
                phone: '+201000000007',
                passwordHash: secretaryPass,
                role: 'BRANCH_SECRETARY',
                governorate: 'ALEXANDRIA',
                departmentId: sphinxDept?.id,
                jobTitle: 'Branch Secretary',
                jobTitleAr: 'Branch Secretary',
                mustChangePass: false,
                isActive: true,
            },
        }),
        prisma.user.upsert({
            where: { email: 'cairo.secretary@sphinx.com' },
            update: {},
            create: {
                employeeNumber: 'EMP-0008',
                fullName: 'Rania Cairo Secretary',
                fullNameAr: 'Rania Cairo Secretary',
                email: 'cairo.secretary@sphinx.com',
                phone: '+201000000008',
                passwordHash: secretaryPass,
                role: 'BRANCH_SECRETARY',
                governorate: 'CAIRO',
                departmentId: sphinxDept?.id,
                jobTitle: 'Branch Secretary',
                jobTitleAr: 'Branch Secretary',
                mustChangePass: false,
                isActive: true,
            },
        }),
    ]);

    const supportPass = await bcrypt.hash('Support@123', 12);
    const supportUser = await prisma.user.upsert({
        where: { email: 'support@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0009',
            fullName: 'Support Agent',
            fullNameAr: 'Support Agent',
            email: 'support@sphinx.com',
            phone: '+201000000009',
            passwordHash: supportPass,
            role: 'SUPPORT',
            governorate: 'CAIRO',
            departmentId: sphinxDept?.id,
            jobTitle: 'Support Agent',
            jobTitleAr: 'Support Agent',
            mustChangePass: false,
            isActive: true,
        },
    });

    const empPass = await bcrypt.hash('Emp@123456', 12);
    const employee = await prisma.user.upsert({
        where: { email: 'employee@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0010',
            fullName: 'Mohammed Ali',
            fullNameAr: 'Mohammed Ali',
            email: 'employee@sphinx.com',
            phone: '+201000000010',
            passwordHash: empPass,
            role: 'EMPLOYEE',
            governorate: 'ALEXANDRIA',
            departmentId: ercDept?.id,
            jobTitle: 'ERC Specialist',
            jobTitleAr: 'ERC Specialist',
            mustChangePass: false,
            isActive: true,
        },
    });

    const employee2 = await prisma.user.upsert({
        where: { email: 'employee.cairo@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0011',
            fullName: 'Sara Ibrahim',
            fullNameAr: 'Sara Ibrahim',
            email: 'employee.cairo@sphinx.com',
            phone: '+201000000011',
            passwordHash: empPass,
            role: 'EMPLOYEE',
            governorate: 'CAIRO',
            departmentId: sphinxDept?.id,
            jobTitle: 'SPHINX Specialist',
            jobTitleAr: 'SPHINX Specialist',
            mustChangePass: false,
            isActive: true,
        },
    });

    const extraEmployeesData = [
        {
            employeeNumber: 'EMP-0012',
            fullName: 'Ahmed Hassan',
            fullNameAr: 'Ahmed Hassan',
            email: 'ahmed.erc.alex@sphinx.com',
            phone: '+201000000012',
            governorate: 'ALEXANDRIA' as const,
            departmentId: ercDept?.id,
            jobTitle: 'ERC Analyst',
        },
        {
            employeeNumber: 'EMP-0013',
            fullName: 'Reem Soliman',
            fullNameAr: 'Reem Soliman',
            email: 'reem.erc.alex@sphinx.com',
            phone: '+201000000013',
            governorate: 'ALEXANDRIA' as const,
            departmentId: ercDept?.id,
            jobTitle: 'ERC Coordinator',
        },
        {
            employeeNumber: 'EMP-0014',
            fullName: 'Omar Saeed',
            fullNameAr: 'Omar Saeed',
            email: 'omar.sphinx.alex@sphinx.com',
            phone: '+201000000014',
            governorate: 'ALEXANDRIA' as const,
            departmentId: sphinxDept?.id,
            jobTitle: 'SPHINX Specialist',
        },
        {
            employeeNumber: 'EMP-0015',
            fullName: 'Mariam Nabil',
            fullNameAr: 'Mariam Nabil',
            email: 'mariam.sphinx.alex@sphinx.com',
            phone: '+201000000015',
            governorate: 'ALEXANDRIA' as const,
            departmentId: sphinxDept?.id,
            jobTitle: 'SPHINX Coordinator',
        },
        {
            employeeNumber: 'EMP-0016',
            fullName: 'Kareem Adel',
            fullNameAr: 'Kareem Adel',
            email: 'kareem.erc.cairo@sphinx.com',
            phone: '+201000000016',
            governorate: 'CAIRO' as const,
            departmentId: ercDept?.id,
            jobTitle: 'ERC Specialist',
        },
        {
            employeeNumber: 'EMP-0017',
            fullName: 'Nada Ahmed',
            fullNameAr: 'Nada Ahmed',
            email: 'nada.erc.cairo@sphinx.com',
            phone: '+201000000017',
            governorate: 'CAIRO' as const,
            departmentId: ercDept?.id,
            jobTitle: 'ERC Officer',
        },
        {
            employeeNumber: 'EMP-0018',
            fullName: 'Youssef Ali',
            fullNameAr: 'Youssef Ali',
            email: 'youssef.sphinx.cairo@sphinx.com',
            phone: '+201000000018',
            governorate: 'CAIRO' as const,
            departmentId: sphinxDept?.id,
            jobTitle: 'SPHINX Analyst',
        },
        {
            employeeNumber: 'EMP-0019',
            fullName: 'Salma Tarek',
            fullNameAr: 'Salma Tarek',
            email: 'salma.sphinx.cairo@sphinx.com',
            phone: '+201000000019',
            governorate: 'CAIRO' as const,
            departmentId: sphinxDept?.id,
            jobTitle: 'SPHINX Officer',
        },
        {
            employeeNumber: 'EMP-0020',
            fullName: 'Hana Mostafa',
            fullNameAr: 'Hana Mostafa',
            email: 'hana.erc.alex@sphinx.com',
            phone: '+201000000020',
            governorate: 'ALEXANDRIA' as const,
            departmentId: ercDept?.id,
            jobTitle: 'ERC Assistant',
        },
        {
            employeeNumber: 'EMP-0021',
            fullName: 'Tamer Eid',
            fullNameAr: 'Tamer Eid',
            email: 'tamer.sphinx.cairo@sphinx.com',
            phone: '+201000000021',
            governorate: 'CAIRO' as const,
            departmentId: sphinxDept?.id,
            jobTitle: 'SPHINX Coordinator',
        },
    ];

    const extraEmployees = await Promise.all(
        extraEmployeesData.map((emp) =>
            prisma.user.upsert({
                where: { email: emp.email },
                update: {},
                create: {
                    employeeNumber: emp.employeeNumber,
                    fullName: emp.fullName,
                    fullNameAr: emp.fullNameAr,
                    email: emp.email,
                    phone: emp.phone,
                    passwordHash: empPass,
                    role: 'EMPLOYEE',
                    governorate: emp.governorate,
                    departmentId: emp.departmentId,
                    jobTitle: emp.jobTitle,
                    jobTitleAr: emp.jobTitle,
                    mustChangePass: false,
                    isActive: true,
                },
            }),
        ),
    );

    console.log('Created users: superadmin, hradmin, managers, secretaries, support, employees');

    const year = new Date().getFullYear();
    const allUsers = [
        superAdmin,
        hrAdmin,
        alexErcManager,
        alexSphinxManager,
        cairoErcManager,
        cairoSphinxManager,
        alexSecretary,
        cairoSecretary,
        supportUser,
        employee,
        employee2,
        ...extraEmployees,
    ];

    for (const user of allUsers) {
        for (const [leaveType, days] of [
            ['ANNUAL', 21],
            ['CASUAL', 7],
            ['EMERGENCY', 3],
            ['MISSION', 10],
        ] as const) {
            await prisma.leaveBalance.upsert({
                where: { userId_year_leaveType: { userId: user.id, year, leaveType } },
                update: {},
                create: {
                    userId: user.id,
                    year,
                    leaveType,
                    totalDays: days,
                    usedDays: 0,
                    remainingDays: days,
                },
            });
        }
    }

    console.log('Created leave balances');

    const sampleNotes = [
        {
            id: 'note-employee-1',
            userId: employee.id,
            date: new Date(),
            title: 'Weekly focus',
            body: 'Finish onboarding tasks and review pending tickets.',
        },
        {
            id: 'note-employee-2',
            userId: employee2.id,
            date: new Date(),
            title: 'Client follow-up',
            body: 'Call client and prepare the follow-up report.',
        },
        {
            id: 'note-employee-3',
            userId: extraEmployees[0]?.id,
            date: new Date(),
            title: 'Training',
            body: 'Attend ERC compliance training session.',
        },
    ];

    for (const note of sampleNotes) {
        if (!note.userId) continue;
        await prisma.note.upsert({
            where: { id: note.id },
            update: {
                userId: note.userId,
                date: note.date,
                title: note.title,
                body: note.body,
            },
            create: note,
        });
    }

    console.log('Created sample notes');

    await prisma.dynamicForm.upsert({
        where: { id: 'form-commission-request' },
        update: {},
        create: {
            id: 'form-commission-request',
            name: 'Commission Request',
            nameAr: 'Commission Request',
            description: 'Request for sales commission',
            descriptionAr: 'Request for sales commission',
            departmentId: sphinxDept?.id,
            requiresManager: true,
            requiresHr: true,
            fields: {
                create: [
                    { label: 'Client Name', labelAr: 'Client Name', fieldType: 'TEXT', isRequired: true, order: 0 },
                    { label: 'Sale Amount', labelAr: 'Sale Amount', fieldType: 'NUMBER', isRequired: true, order: 1 },
                    { label: 'Commission Rate (%)', labelAr: 'Commission Rate (%)', fieldType: 'NUMBER', isRequired: true, order: 2 },
                    { label: 'Sale Date', labelAr: 'Sale Date', fieldType: 'DATE', isRequired: true, order: 3 },
                    { label: 'Notes', labelAr: 'Notes', fieldType: 'TEXTAREA', isRequired: false, order: 4 },
                ],
            },
        },
    });

    await prisma.dynamicForm.upsert({
        where: { id: 'form-purchase-request' },
        update: {},
        create: {
            id: 'form-purchase-request',
            name: 'Purchase Request',
            nameAr: 'Purchase Request',
            description: 'Request for purchasing items',
            descriptionAr: 'Request for purchasing items',
            departmentId: ercDept?.id,
            requiresManager: true,
            requiresHr: true,
            fields: {
                create: [
                    { label: 'Item Name', labelAr: 'Item Name', fieldType: 'TEXT', isRequired: true, order: 0 },
                    { label: 'Quantity', labelAr: 'Quantity', fieldType: 'NUMBER', isRequired: true, order: 1 },
                    { label: 'Estimated Cost', labelAr: 'Estimated Cost', fieldType: 'NUMBER', isRequired: true, order: 2 },
                    { label: 'Supplier', labelAr: 'Supplier', fieldType: 'TEXT', isRequired: false, order: 3 },
                    { label: 'Priority', labelAr: 'Priority', fieldType: 'SELECT', isRequired: true, options: ['Low', 'Medium', 'High', 'Urgent'], order: 4 },
                    { label: 'Justification', labelAr: 'Justification', fieldType: 'TEXTAREA', isRequired: true, order: 5 },
                ],
            },
        },
    });

    console.log('Database seeded successfully!');
    console.log('Default login credentials:');
    console.log('  Super Admin:  superadmin@sphinx.com / Admin@123456');
    console.log('  HR Admin:     hradmin@sphinx.com    / HrAdmin@123');
    console.log('  Manager:      erc.alex.manager@sphinx.com / Manager@123');
    console.log('  Secretary:    alex.secretary@sphinx.com / Secretary@123');
    console.log('  Support:      support@sphinx.com    / Support@123');
    console.log('  Employee:     employee@sphinx.com   / Emp@123456');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
