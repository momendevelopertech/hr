import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding SPHINX HR database...');

    // Create departments
    const departments = await Promise.all([
        prisma.department.upsert({
            where: { name: 'Management' },
            update: {},
            create: { name: 'Management', nameAr: 'الإدارة', description: 'Company management' },
        }),
        prisma.department.upsert({
            where: { name: 'Sales' },
            update: {},
            create: { name: 'Sales', nameAr: 'المبيعات', description: 'Sales department' },
        }),
        prisma.department.upsert({
            where: { name: 'HR' },
            update: {},
            create: { name: 'HR', nameAr: 'الموارد البشرية', description: 'Human resources' },
        }),
        prisma.department.upsert({
            where: { name: 'ERC' },
            update: {},
            create: { name: 'ERC', nameAr: 'مركز ERC', description: 'ERC Department' },
        }),
        prisma.department.upsert({
            where: { name: 'Others' },
            update: {},
            create: { name: 'Others', nameAr: 'أخرى', description: 'Other departments' },
        }),
    ]);

    console.log(`✅ Created ${departments.length} departments`);

    const hrDept = departments.find((d) => d.name === 'HR');
    const mgmtDept = departments.find((d) => d.name === 'Management');
    const salesDept = departments.find((d) => d.name === 'Sales');

    // Create Super Admin
    const superAdminPass = await bcrypt.hash('Admin@123456', 12);
    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0001',
            fullName: 'Super Admin',
            fullNameAr: 'المشرف العام',
            email: 'superadmin@sphinx.com',
            phone: '+201000000001',
            passwordHash: superAdminPass,
            role: 'SUPER_ADMIN',
            departmentId: mgmtDept?.id,
            jobTitle: 'System Administrator',
            jobTitleAr: 'مسؤول النظام',
            mustChangePass: false,
            isActive: true,
        },
    });

    // Create HR Admin
    const hrAdminPass = await bcrypt.hash('HrAdmin@123', 12);
    const hrAdmin = await prisma.user.upsert({
        where: { email: 'hradmin@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0002',
            fullName: 'Sarah HR Manager',
            fullNameAr: 'سارة مدير الموارد البشرية',
            email: 'hradmin@sphinx.com',
            phone: '+201000000002',
            passwordHash: hrAdminPass,
            role: 'HR_ADMIN',
            departmentId: hrDept?.id,
            jobTitle: 'HR Manager',
            jobTitleAr: 'مدير الموارد البشرية',
            mustChangePass: false,
            isActive: true,
        },
    });

    // Create Manager
    const managerPass = await bcrypt.hash('Manager@123', 12);
    const manager = await prisma.user.upsert({
        where: { email: 'manager@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0003',
            fullName: 'Ahmed Sales Manager',
            fullNameAr: 'أحمد مدير المبيعات',
            email: 'manager@sphinx.com',
            phone: '+201000000003',
            passwordHash: managerPass,
            role: 'MANAGER',
            departmentId: salesDept?.id,
            jobTitle: 'Sales Manager',
            jobTitleAr: 'مدير المبيعات',
            mustChangePass: false,
            isActive: true,
        },
    });

    // Create Employee
    const empPass = await bcrypt.hash('Emp@123456', 12);
    const employee = await prisma.user.upsert({
        where: { email: 'employee@sphinx.com' },
        update: {},
        create: {
            employeeNumber: 'EMP-0004',
            fullName: 'Mohammed Ali',
            fullNameAr: 'محمد علي',
            email: 'employee@sphinx.com',
            phone: '+201000000004',
            passwordHash: empPass,
            role: 'EMPLOYEE',
            departmentId: salesDept?.id,
            jobTitle: 'Sales Representative',
            jobTitleAr: 'ممثل مبيعات',
            mustChangePass: false,
            isActive: true,
        },
    });

    console.log('✅ Created users: superadmin, hradmin, manager, employee');

    // Create leave balances for all users
    const year = new Date().getFullYear();
    const allUsers = [superAdmin, hrAdmin, manager, employee];

    for (const user of allUsers) {
        for (const [leaveType, days] of [['ANNUAL', 21], ['EMERGENCY', 3], ['MISSION', 10]] as const) {
            await prisma.leaveBalance.upsert({
                where: { userId_year_leaveType: { userId: user.id, year, leaveType } },
                update: {},
                create: {
                    userId: user.id, year, leaveType, totalDays: days, usedDays: 0, remainingDays: days,
                },
            });
        }
    }

    console.log('✅ Created leave balances');

    // Create sample dynamic forms
    const salesForm = await prisma.dynamicForm.upsert({
        where: { id: 'form-commission-request' },
        update: {},
        create: {
            id: 'form-commission-request',
            name: 'Commission Request',
            nameAr: 'طلب عمولة',
            description: 'Request for sales commission',
            descriptionAr: 'طلب عمولة على المبيعات',
            departmentId: salesDept?.id,
            requiresManager: true,
            requiresHr: true,
            fields: {
                create: [
                    { label: 'Client Name', labelAr: 'اسم العميل', fieldType: 'TEXT', isRequired: true, order: 0 },
                    { label: 'Sale Amount', labelAr: 'قيمة البيع', fieldType: 'NUMBER', isRequired: true, order: 1 },
                    { label: 'Commission Rate (%)', labelAr: 'نسبة العمولة (%)', fieldType: 'NUMBER', isRequired: true, order: 2 },
                    { label: 'Sale Date', labelAr: 'تاريخ البيع', fieldType: 'DATE', isRequired: true, order: 3 },
                    { label: 'Notes', labelAr: 'ملاحظات', fieldType: 'TEXTAREA', isRequired: false, order: 4 },
                ],
            },
        },
    });

    const purchaseForm = await prisma.dynamicForm.upsert({
        where: { id: 'form-purchase-request' },
        update: {},
        create: {
            id: 'form-purchase-request',
            name: 'Purchase Request',
            nameAr: 'طلب شراء',
            description: 'Request for purchasing items',
            descriptionAr: 'طلب شراء مستلزمات',
            departmentId: mgmtDept?.id,
            requiresManager: true,
            requiresHr: true,
            fields: {
                create: [
                    { label: 'Item Name', labelAr: 'اسم الصنف', fieldType: 'TEXT', isRequired: true, order: 0 },
                    { label: 'Quantity', labelAr: 'الكمية', fieldType: 'NUMBER', isRequired: true, order: 1 },
                    { label: 'Estimated Cost', labelAr: 'التكلفة المتوقعة', fieldType: 'NUMBER', isRequired: true, order: 2 },
                    { label: 'Supplier', labelAr: 'المورد', fieldType: 'TEXT', isRequired: false, order: 3 },
                    { label: 'Priority', labelAr: 'الأولوية', fieldType: 'SELECT', isRequired: true, options: ['Low', 'Medium', 'High', 'Urgent'], order: 4 },
                    { label: 'Justification', labelAr: 'المبرر', fieldType: 'TEXTAREA', isRequired: true, order: 5 },
                ],
            },
        },
    });

    console.log('✅ Created sample forms');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\nDefault login credentials:');
    console.log('  Super Admin: superadmin@sphinx.com / Admin@123456');
    console.log('  HR Admin:    hradmin@sphinx.com    / HrAdmin@123');
    console.log('  Manager:     manager@sphinx.com     / Manager@123');
    console.log('  Employee:    employee@sphinx.com    / Emp@123456');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
