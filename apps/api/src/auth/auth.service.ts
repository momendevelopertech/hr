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
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addMinutes } from 'date-fns';
import { getJwtKeys } from './jwt-keys';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
    ) { }

    async login(identifier: string, password: string, rememberMe = false, ipAddress?: string, userAgent?: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier.toLowerCase() },
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
                await this.notificationsService.sendWhatsApp(
                    user.phone,
                    `⚠️ SPHINX HR: Your account has been locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts. Contact HR to unlock.`,
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
        );

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                fullName: user.fullName,
                fullNameAr: user.fullNameAr,
                role: user.role,
                mustChangePass: user.mustChangePass,
                department: user.department,
                profileImage: user.profileImage,
                employeeNumber: user.employeeNumber,
            },
        };
    }

    async logout(userId: string, refreshToken: string) {
        await this.prisma.refreshToken.updateMany({
            where: { userId, token: refreshToken },
            data: { isRevoked: true },
        });

        await this.auditService.log({ userId, action: 'LOGOUT' });
    }

    async refreshTokens(refreshToken: string, rememberMe = false) {
        const stored = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });

        if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Rotate refresh token
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { isRevoked: true },
        });

        const tokens = await this.generateTokens(
            stored.user.id,
            stored.user.email,
            stored.user.role,
            rememberMe ? this.getRememberMeRefreshDays() : undefined,
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

    async requestPasswordReset(email: string, locale = 'en') {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) return; // Don't reveal user existence

        const resetToken = uuidv4();
        // Store token with expiry (1 hour)
        await this.prisma.refreshToken.create({
            data: {
                token: `reset_${resetToken}`,
                userId: user.id,
                expiresAt: addMinutes(new Date(), 60),
            },
        });

        const safeLocale = ['en', 'ar'].includes(locale) ? locale : 'en';
        const resetUrl = `${process.env.FRONTEND_URL}/${safeLocale}/reset-password?token=${resetToken}`;

        await this.notificationsService.sendEmail({
            to: user.email,
            subject: 'SPHINX HR - Password Reset',
            html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
        });

        if (user.phone) {
            await this.notificationsService.sendWhatsApp(
                user.phone,
                `🔐 SPHINX HR: A password reset was requested for your account. If you didn't request this, please contact HR immediately. Reset link: ${resetUrl}`,
            );
        }
    }

    async resetPassword(token: string, newPassword: string) {
        const stored = await this.prisma.refreshToken.findUnique({
            where: { token: `reset_${token}` },
        });

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

        await this.auditService.log({ userId: stored.userId, action: 'PASSWORD_RESET' });
    }

    private getRememberMeRefreshDays() {
        const rememberDays = parseInt(process.env.REMEMBER_ME_REFRESH_DAYS || '30', 10);
        return Number.isNaN(rememberDays) ? 30 : rememberDays;
    }

    private async generateTokens(userId: string, email: string, role: string, refreshDaysOverride?: number) {
        const payload = { sub: userId, email, role };
        const keys = getJwtKeys();

        const accessToken = this.jwtService.sign(payload, {
            privateKey: keys.privateKey,
            algorithm: 'RS256',
            expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
        });

        const refreshToken = uuidv4();
        const refreshDays = refreshDaysOverride ?? parseInt((process.env.JWT_REFRESH_EXPIRES || '7d').replace('d', ''), 10);
        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId,
                expiresAt: addDays(new Date(), Number.isNaN(refreshDays) ? 7 : refreshDays),
            },
        });

        return { accessToken, refreshToken };
    }
}
