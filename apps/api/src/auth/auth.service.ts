import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addMinutes } from 'date-fns';
import { getJwtKeys } from './jwt-keys';
import { createHmac } from 'crypto';
import { normalizeEgyptMobilePhone } from '../shared/egypt-phone';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;
const REFRESH_TOKEN_DAYS = 7;

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
        private usersService: UsersService,
    ) { }

    private buildUserProfile(user: any) {
        return {
            id: user.id,
            email: user.email,
            phone: user.phone,
            username: user.username,
            fullName: user.fullName,
            fullNameAr: user.fullNameAr,
            role: user.role,
            governorate: user.governorate,
            branchId: user.branchId,
            mustChangePass: user.mustChangePass,
            department: user.department,
            profileImage: user.profileImage,
            employeeNumber: user.employeeNumber,
            jobTitle: user.jobTitle,
            jobTitleAr: user.jobTitleAr,
            workflowMode: user.workflowMode,
        };
    }

    private getRefreshTokenSecret() {
        return (
            process.env.REFRESH_TOKEN_SECRET ||
            process.env.JWT_PRIVATE_KEY ||
            process.env.CSRF_SECRET ||
            'dev-refresh-secret'
        );
    }

    private hashToken(token: string, purpose: 'refresh' | 'reset') {
        return createHmac('sha256', this.getRefreshTokenSecret())
            .update(`${purpose}:${token}`)
            .digest('hex');
    }

    private normalizeResetIdentifier(identifier?: string | null) {
        const raw = (identifier || '').trim();
        if (!raw) return { raw: '', email: '', phone: '' };
        return {
            raw,
            email: raw.includes('@') ? raw.toLowerCase() : '',
            phone: normalizeEgyptMobilePhone(raw),
        };
    }

    private hasEmailConfig() {
        return this.notificationsService.hasEmailConfig();
    }

    private async hasWhatsAppConfig() {
        return this.notificationsService.hasWhatsAppConfig();
    }

    private async getResetDeliveryChannel(
        user: { email: string; phone?: string | null },
        preferred: 'EMAIL' | 'WHATSAPP',
    ) {
        if (preferred === 'WHATSAPP' && user.phone && await this.hasWhatsAppConfig()) {
            return 'WHATSAPP' as const;
        }

        if (user.email && this.hasEmailConfig()) {
            return 'EMAIL' as const;
        }

        if (user.phone && await this.hasWhatsAppConfig()) {
            return 'WHATSAPP' as const;
        }

        return null;
    }

    private generateResetCode() {
        return String(Math.floor(100000 + Math.random() * 900000));
    }

    private async revokeAllRefreshTokens(userId: string) {
        await this.prisma.refreshToken.updateMany({
            where: { userId, tokenType: 'REFRESH' },
            data: { isRevoked: true },
        });
    }

    async getRegistrationOptions() {
        const [branches, departments] = await Promise.all([
            this.prisma.branch.findMany({
                orderBy: { id: 'asc' },
                select: { id: true, name: true, nameAr: true },
            }),
            this.prisma.department.findMany({
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    nameAr: true,
                    branches: {
                        select: {
                            branch: {
                                select: {
                                    id: true,
                                    name: true,
                                    nameAr: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        return {
            branches,
            departments: departments.map((department) => ({
                id: department.id,
                name: department.name,
                nameAr: department.nameAr,
                branches: department.branches.map((link) => link.branch),
            })),
        };
    }

    async login(identifier: string, password: string, rememberMe = false, ipAddress?: string, userAgent?: string) {
        const normalized = identifier.trim().toLowerCase();
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalized },
                    { username: normalized },
                ],
            },
            include: { department: true },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            await this.auditService.log({
                userId: user.id,
                action: 'ACCOUNT_LOCKED',
                ipAddress,
                userAgent,
                details: { reason: 'Attempted login while locked' },
            });
            throw new ForbiddenException('Account is temporarily locked. Please try again later.');
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            const failedCount = user.failedLoginCount + 1;
            const updateData: any = { failedLoginCount: failedCount };

            if (failedCount >= MAX_FAILED_ATTEMPTS) {
                updateData.lockedUntil = addMinutes(new Date(), LOCK_DURATION_MINUTES);
            }

            await this.prisma.user.update({ where: { id: user.id }, data: updateData });

            await this.auditService.log({
                userId: user.id,
                action: 'LOGIN_FAILED',
                ipAddress,
                userAgent,
                details: { failedCount },
            });

            if (failedCount >= MAX_FAILED_ATTEMPTS) {
                // Send WhatsApp notification about locked account
                this.notificationsService.sendWhatsAppInBackground(
                    user.phone,
                    `⚠️ SPHINX HR: Your account has been locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts. Contact HR to unlock.`,
                    `Deferred account lock WhatsApp failed for user ${user.id}`,
                );
                throw new ForbiddenException('Account locked after too many failed attempts.');
            }

            throw new UnauthorizedException(`Invalid credentials. ${MAX_FAILED_ATTEMPTS - failedCount} attempts remaining.`);
        }

        if (!user.isActive) {
            throw new ForbiddenException('Account is deactivated. Contact HR.');
        }

        // Reset failed attempts on successful login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount: 0, lockedUntil: null },
        });

        await this.auditService.log({
            userId: user.id,
            action: 'LOGIN',
            ipAddress,
            userAgent,
        });

        const tokens = await this.generateTokens(
            user.id,
            user.email,
            user.role,
            rememberMe ? this.getRememberMeRefreshDays() : undefined,
            { ipAddress, userAgent },
        );

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: this.buildUserProfile(user),
        };
    }

    async register(
        data: {
            fullName: string;
            fullNameAr?: string;
            email: string;
            phone: string;
            password: string;
            branchId: number;
            departmentId: string;
            jobTitle: string;
            jobTitleAr?: string;
        },
        ipAddress?: string,
        userAgent?: string,
    ) {
        const user = await this.usersService.createSelfRegisteredUser(data);

        await this.auditService.log({
            userId: user.id,
            action: 'LOGIN',
            ipAddress,
            userAgent,
            details: { selfRegistered: true },
        });

        const tokens = await this.generateTokens(user.id, user.email, user.role, undefined, {
            ipAddress,
            userAgent,
        });

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: this.buildUserProfile(user),
        };
    }

    async logout(userId: string | undefined, refreshToken: string | undefined) {
        if (refreshToken) {
            const tokenHash = this.hashToken(refreshToken, 'refresh');
            await this.prisma.refreshToken.updateMany({
                where: {
                    token: tokenHash,
                    tokenType: 'REFRESH',
                    ...(userId ? { userId } : {}),
                },
                data: { isRevoked: true },
            });
        }

        if (userId) {
            await this.auditService.log({ userId, action: 'LOGOUT' });
        }
    }

    async refreshTokens(refreshToken: string, rememberMe = false, ipAddress?: string, userAgent?: string) {
        if (!refreshToken) {
            throw new UnauthorizedException('Missing refresh token');
        }

        const tokenHash = this.hashToken(refreshToken, 'refresh');
        const stored = await this.prisma.refreshToken.findFirst({
            where: { token: tokenHash, tokenType: 'REFRESH' },
            include: { user: true },
        });

        if (!stored) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (stored.isRevoked) {
            await this.revokeAllRefreshTokens(stored.userId);
            throw new UnauthorizedException('Refresh token revoked');
        }

        if (stored.expiresAt < new Date()) {
            await this.revokeAllRefreshTokens(stored.userId);
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (
            (stored.ipAddress && ipAddress && stored.ipAddress !== ipAddress)
            || (stored.userAgent && userAgent && stored.userAgent !== userAgent)
        ) {
            await this.revokeAllRefreshTokens(stored.userId);
            throw new ForbiddenException('Session verification failed. Please sign in again.');
        }

        const tokens = await this.generateTokens(
            stored.user.id,
            stored.user.email,
            stored.user.role,
            rememberMe ? this.getRememberMeRefreshDays() : undefined,
            { ipAddress, userAgent, replaceTokenId: stored.id },
        );
        return tokens;
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            throw new BadRequestException('Current password is incorrect');
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hash, mustChangePass: false },
        });

        await this.auditService.log({ userId, action: 'PASSWORD_CHANGED' });
    }

    async requestPasswordReset(identifier?: string, locale = 'en') {
        const normalized = this.normalizeResetIdentifier(identifier);
        if (!normalized.raw) return;

        const user = await this.prisma.user.findFirst({
            where: normalized.email
                ? { email: normalized.email }
                : normalized.phone
                    ? { phone: normalized.phone }
                    : { email: '__not_found__' },
        });
        if (!user) return; // Don't reveal user existence

        const preferredChannel = normalized.email ? 'EMAIL' : 'WHATSAPP';
        const deliveryChannel = await this.getResetDeliveryChannel(user, preferredChannel);
        if (!deliveryChannel) return;

        await this.prisma.refreshToken.updateMany({
            where: { userId: user.id, tokenType: 'RESET', isRevoked: false },
            data: { isRevoked: true },
        });

        const resetCode = this.generateResetCode();
        const resetHash = this.hashToken(`${user.id}:${resetCode}`, 'reset');
        await this.prisma.refreshToken.create({
            data: {
                token: resetHash,
                tokenType: 'RESET',
                userId: user.id,
                expiresAt: addMinutes(new Date(), 10),
            },
        });

        const safeLocale = ['en', 'ar'].includes(locale) ? locale : 'en';
        await this.notificationsService.sendPasswordResetCode({
            user,
            code: resetCode,
            locale: safeLocale,
            channel: deliveryChannel,
        });

        const resetUrl = '';
        if (process.env.NODE_ENV === 'legacy-reset-link' && user.phone) {
            this.notificationsService.sendWhatsAppInBackground(
                user.phone,
                `🔐 SPHINX HR: A password reset was requested for your account. If you didn't request this, please contact HR immediately. Reset link: ${resetUrl}`,
                `Deferred legacy password reset alert failed for user ${user.id}`,
            );
        }
    }

    async resetPassword(token: string | undefined, newPassword: string, identifier?: string) {
        const normalized = this.normalizeResetIdentifier(identifier);
        const tokenValue = (token || '').trim();

        let stored = null;
        if (normalized.raw) {
            const user = await this.prisma.user.findFirst({
                where: normalized.email
                    ? { email: normalized.email }
                    : normalized.phone
                        ? { phone: normalized.phone }
                        : { email: '__not_found__' },
            });
            if (!user || !tokenValue) {
                throw new BadRequestException('Invalid or expired reset token');
            }
            const resetHash = this.hashToken(`${user.id}:${tokenValue}`, 'reset');
            stored = await this.prisma.refreshToken.findFirst({
                where: {
                    userId: user.id,
                    token: resetHash,
                    tokenType: 'RESET',
                },
            });
        } else {
            const resetHash = this.hashToken(tokenValue, 'reset');
            stored = await this.prisma.refreshToken.findFirst({
                where: { token: resetHash, tokenType: 'RESET' },
            });
        }

        if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({
            where: { id: stored.userId },
            data: { passwordHash: hash, mustChangePass: false },
        });

        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { isRevoked: true },
        });

        await this.prisma.refreshToken.updateMany({
            where: { userId: stored.userId, tokenType: 'RESET', isRevoked: false },
            data: { isRevoked: true },
        });

        await this.auditService.log({ userId: stored.userId, action: 'PASSWORD_RESET' });
    }

    async updateWorkflowMode(userId: string, workflowMode: 'SANDBOX' | 'APPROVAL_WORKFLOW') {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { department: true },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.role !== 'EMPLOYEE') {
            throw new ForbiddenException('Only employees can switch workflow mode');
        }

        if (user.workflowMode === workflowMode) {
            return this.buildUserProfile(user);
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { workflowMode },
            include: { department: true },
        });

        await this.auditService.log({
            userId,
            action: 'EMPLOYEE_UPDATED',
            entity: 'User',
            entityId: userId,
            details: { workflowMode },
        });

        return this.buildUserProfile(updated);
    }

    private getRememberMeRefreshDays() {
        return REFRESH_TOKEN_DAYS;
    }

    private async generateTokens(
        userId: string,
        email: string,
        role: string,
        refreshDaysOverride?: number,
        options?: { ipAddress?: string; userAgent?: string; replaceTokenId?: string },
    ) {
        const payload = { sub: userId, email, role };
        const keys = getJwtKeys();

        const accessToken = this.jwtService.sign(payload, {
            privateKey: keys.privateKey,
            algorithm: 'RS256',
            expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
        });

        const refreshToken = uuidv4();
        const refreshHash = this.hashToken(refreshToken, 'refresh');
        const refreshDays = refreshDaysOverride ?? REFRESH_TOKEN_DAYS;
        const expiresAt = addDays(new Date(), refreshDays);

        const createToken = () => this.prisma.refreshToken.create({
            data: {
                token: refreshHash,
                tokenType: 'REFRESH',
                userId,
                expiresAt,
                ipAddress: options?.ipAddress,
                userAgent: options?.userAgent,
            },
        });

        if (options?.replaceTokenId) {
            const newToken = await createToken();
            await this.prisma.refreshToken.update({
                where: { id: options.replaceTokenId },
                data: { isRevoked: true, replacedById: newToken.id },
            });
        } else {
            await createToken();
        }

        return { accessToken, refreshToken };
    }
}
