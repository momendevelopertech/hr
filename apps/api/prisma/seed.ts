import { PrismaClient, Role, Governorate } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type SeedUser = {
    employeeNumber: string;
    fullName: string;
    fullNameAr: string;
    email: string;
    username: string;
    password: string;
    role: Role;
    governorate: Governorate;
    departmentName?: 'ERC' | 'SPHINX';
    phone: string;
    jobTitle: string;
    jobTitleAr: string;
};

const departmentsData = [
    { name: 'ERC', nameAr: 'ERC', description: 'ERC Department' },
    { name: 'SPHINX', nameAr: 'SPHINX', description: 'SPHINX Department' },
] as const;

const requiredUsers: SeedUser[] = [
    {
        employeeNumber: 'EMP-0001',
        fullName: 'Super Admin',
        fullNameAr: 'Super Admin',
        email: 'superadmin@sphinx.com',
        username: 'super-admin',
        password: 'Admin@123456',
        role: 'SUPER_ADMIN',
        governorate: 'CAIRO',
        departmentName: 'SPHINX',
        phone: '+201000000001',
        jobTitle: 'System Administrator',
        jobTitleAr: 'System Administrator',
    },
    {
        employeeNumber: 'EMP-0002',
        fullName: 'HR Admin',
        fullNameAr: 'HR Admin',
        email: 'hradmin@sphinx.com',
        username: 'hr-admin',
        password: 'HrAdmin@123',
        role: 'HR_ADMIN',
        governorate: 'CAIRO',
        departmentName: 'ERC',
        phone: '+201000000002',
        jobTitle: 'HR Admin',
        jobTitleAr: 'HR Admin',
    },
    {
        employeeNumber: 'EMP-0003',
        fullName: 'Alexandria Secretary',
        fullNameAr: 'Alexandria Secretary',
        email: 'secretary.alex@sphinx.com',
        username: 'secretary-alex',
        password: 'Sec@123',
        role: 'BRANCH_SECRETARY',
        governorate: 'ALEXANDRIA',
        phone: '+201000000003',
        jobTitle: 'Branch Secretary',
        jobTitleAr: 'Branch Secretary',
    },
    {
        employeeNumber: 'EMP-0004',
        fullName: 'Cairo Secretary',
        fullNameAr: 'Cairo Secretary',
        email: 'secretary.cairo@sphinx.com',
        username: 'secretary-cairo',
        password: 'Sec@123',
        role: 'BRANCH_SECRETARY',
        governorate: 'CAIRO',
        phone: '+201000000004',
        jobTitle: 'Branch Secretary',
        jobTitleAr: 'Branch Secretary',
    },
    {
        employeeNumber: 'EMP-0005',
        fullName: 'Manager Alex ERC',
        fullNameAr: 'Manager Alex ERC',
        email: 'manager.alex.erc@sphinx.com',
        username: 'manager-alex-erc',
        password: 'Manager@123',
        role: 'MANAGER',
        governorate: 'ALEXANDRIA',
        departmentName: 'ERC',
        phone: '+201000000005',
        jobTitle: 'Department Manager',
        jobTitleAr: 'Department Manager',
    },
    {
        employeeNumber: 'EMP-0006',
        fullName: 'Manager Alex SPHINX',
        fullNameAr: 'Manager Alex SPHINX',
        email: 'manager.alex.sphinx@sphinx.com',
        username: 'manager-alex-sphinx',
        password: 'Manager@123',
        role: 'MANAGER',
        governorate: 'ALEXANDRIA',
        departmentName: 'SPHINX',
        phone: '+201000000006',
        jobTitle: 'Department Manager',
        jobTitleAr: 'Department Manager',
    },
    {
        employeeNumber: 'EMP-0007',
        fullName: 'Manager Cairo ERC',
        fullNameAr: 'Manager Cairo ERC',
        email: 'manager.cairo.erc@sphinx.com',
        username: 'manager-cairo-erc',
        password: 'Manager@123',
        role: 'MANAGER',
        governorate: 'CAIRO',
        departmentName: 'ERC',
        phone: '+201000000007',
        jobTitle: 'Department Manager',
        jobTitleAr: 'Department Manager',
    },
    {
        employeeNumber: 'EMP-0008',
        fullName: 'Manager Cairo SPHINX',
        fullNameAr: 'Manager Cairo SPHINX',
        email: 'manager.cairo.sphinx@sphinx.com',
        username: 'manager-cairo-sphinx',
        password: 'Manager@123',
        role: 'MANAGER',
        governorate: 'CAIRO',
        departmentName: 'SPHINX',
        phone: '+201000000008',
        jobTitle: 'Department Manager',
        jobTitleAr: 'Department Manager',
    },
    {
        employeeNumber: 'EMP-0009',
        fullName: 'Momen Alex ERC',
        fullNameAr: 'Momen Alex ERC',
        email: 'momen.alex.erc@sphinx.com',
        username: 'momen-alex-erc',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'ALEXANDRIA',
        departmentName: 'ERC',
        phone: '+201000000009',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
    {
        employeeNumber: 'EMP-0010',
        fullName: 'Ahmed Alex ERC',
        fullNameAr: 'Ahmed Alex ERC',
        email: 'ahmed.alex.erc@sphinx.com',
        username: 'ahmed-alex-erc',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'ALEXANDRIA',
        departmentName: 'ERC',
        phone: '+201000000010',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
    {
        employeeNumber: 'EMP-0011',
        fullName: 'Sara Alex ERC',
        fullNameAr: 'Sara Alex ERC',
        email: 'sara.alex.erc@sphinx.com',
        username: 'sara-alex-erc',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'ALEXANDRIA',
        departmentName: 'ERC',
        phone: '+201000000011',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
    {
        employeeNumber: 'EMP-0012',
        fullName: 'Ali Alex SPHINX',
        fullNameAr: 'Ali Alex SPHINX',
        email: 'ali.alex.sphinx@sphinx.com',
        username: 'ali-alex-sphinx',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'ALEXANDRIA',
        departmentName: 'SPHINX',
        phone: '+201000000012',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
    {
        employeeNumber: 'EMP-0013',
        fullName: 'Nada Alex SPHINX',
        fullNameAr: 'Nada Alex SPHINX',
        email: 'nada.alex.sphinx@sphinx.com',
        username: 'nada-alex-sphinx',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'ALEXANDRIA',
        departmentName: 'SPHINX',
        phone: '+201000000013',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
    {
        employeeNumber: 'EMP-0014',
        fullName: 'Khaled Cairo ERC',
        fullNameAr: 'Khaled Cairo ERC',
        email: 'khaled.cairo.erc@sphinx.com',
        username: 'khaled-cairo-erc',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'CAIRO',
        departmentName: 'ERC',
        phone: '+201000000014',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
    {
        employeeNumber: 'EMP-0015',
        fullName: 'Mariam Cairo ERC',
        fullNameAr: 'Mariam Cairo ERC',
        email: 'mariam.cairo.erc@sphinx.com',
        username: 'mariam-cairo-erc',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'CAIRO',
        departmentName: 'ERC',
        phone: '+201000000015',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
    {
        employeeNumber: 'EMP-0016',
        fullName: 'Omar Cairo SPHINX',
        fullNameAr: 'Omar Cairo SPHINX',
        email: 'omar.cairo.sphinx@sphinx.com',
        username: 'omar-cairo-sphinx',
        password: 'Emp@123456',
        role: 'EMPLOYEE',
        governorate: 'CAIRO',
        departmentName: 'SPHINX',
        phone: '+201000000016',
        jobTitle: 'Employee',
        jobTitleAr: 'Employee',
    },
];

async function upsertUserWithoutDuplicates(data: Omit<SeedUser, 'password' | 'departmentName'> & { passwordHash: string; departmentId?: string }) {
    const username = data.username.toLowerCase();

    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                { employeeNumber: data.employeeNumber },
                { email: data.email.toLowerCase() },
                { username },
            ],
        },
    });

    const payload = {
        employeeNumber: data.employeeNumber,
        fullName: data.fullName,
        fullNameAr: data.fullNameAr,
        email: data.email.toLowerCase(),
        username,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role,
        governorate: data.governorate,
        departmentId: data.departmentId,
        jobTitle: data.jobTitle,
        jobTitleAr: data.jobTitleAr,
        mustChangePass: false,
        isActive: true,
    };

    if (existing) {
        return prisma.user.update({ where: { id: existing.id }, data: payload });
    }

    return prisma.user.create({ data: payload });
}

async function main() {
    console.log('Seeding SPHINX HR database (deduplicated)...');

    const departments = await Promise.all(
        departmentsData.map((dept) =>
            prisma.department.upsert({
                where: { name: dept.name },
                update: { nameAr: dept.nameAr, description: dept.description },
                create: { name: dept.name, nameAr: dept.nameAr, description: dept.description },
            }),
        ),
    );

    const departmentByName = new Map(departments.map((d) => [d.name, d.id]));

    for (const user of requiredUsers) {
        const passwordHash = await bcrypt.hash(user.password, 12);
        await upsertUserWithoutDuplicates({
            employeeNumber: user.employeeNumber,
            fullName: user.fullName,
            fullNameAr: user.fullNameAr,
            email: user.email,
            username: user.username,
            phone: user.phone,
            passwordHash,
            role: user.role,
            governorate: user.governorate,
            departmentId: user.departmentName ? departmentByName.get(user.departmentName) : undefined,
            jobTitle: user.jobTitle,
            jobTitleAr: user.jobTitleAr,
        });
    }

    const year = new Date().getFullYear();
    const seededUsers = await prisma.user.findMany({
        where: { employeeNumber: { in: requiredUsers.map((u) => u.employeeNumber) } },
        select: { id: true },
    });

    for (const user of seededUsers) {
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

    console.log('Database seeded successfully with required accounts.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
