import {
    Controller,
    Post,
    Body,
    Req,
    Res,
    UseGuards,
    HttpCode,
    HttpStatus,
    Get,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto, ResetPasswordRequestDto, ResetPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getCookieSettings } from '../shared/cookie-settings';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    private getCookieAges(rememberMe = false) {
        const accessMs = 15 * 60 * 1000; // 15m
        const rememberDays = parseInt(process.env.REMEMBER_ME_REFRESH_DAYS || '30', 10);
        const rememberMs = (Number.isNaN(rememberDays) ? 30 : rememberDays) * 24 * 60 * 60 * 1000;
        const defaultRefreshMs = 7 * 24 * 60 * 60 * 1000;

        return {
            accessMs,
            refreshMs: rememberMe ? rememberMs : defaultRefreshMs,
        };
    }

    @Post('login')
    @UseGuards(ThrottlerGuard)
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const rememberMe = !!dto.rememberMe;
        const result = await this.authService.login(
            dto.identifier,
            dto.password,
            rememberMe,
            req.ip,
            req.headers['user-agent'],
        );
        const ages = this.getCookieAges(rememberMe);
        const { sameSite, secure } = getCookieSettings();

        // Set HttpOnly cookies
        res.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: ages.accessMs,
        });

        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: ages.refreshMs,
        });

        if (rememberMe) {
            res.cookie('remember_me', '1', {
                httpOnly: true,
                secure,
                sameSite,
                maxAge: ages.refreshMs,
            });
        } else {
            res.clearCookie('remember_me');
        }

        return { user: result.user };
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const refreshToken = req.cookies?.refresh_token;
        await this.authService.logout((req as any).user.id, refreshToken);

        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        res.clearCookie('remember_me');

        return { message: 'Logged out successfully' };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const refreshToken = req.cookies?.refresh_token;
        const rememberMe = req.cookies?.remember_me === '1';
        const tokens = await this.authService.refreshTokens(refreshToken, rememberMe);
        const ages = this.getCookieAges(rememberMe);
        const { sameSite, secure } = getCookieSettings();

        res.cookie('access_token', tokens.accessToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: ages.accessMs,
        });

        res.cookie('refresh_token', tokens.refreshToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: ages.refreshMs,
        });

        return { success: true };
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
        await this.authService.changePassword(
            (req as any).user.id,
            dto.currentPassword,
            dto.newPassword,
        );
        return { message: 'Password changed successfully' };
    }

    @Post('forgot-password')
    @UseGuards(ThrottlerGuard)
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ResetPasswordRequestDto) {
        await this.authService.requestPasswordReset(dto.email);
        return { message: 'If the email exists, a reset link has been sent.' };
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        await this.authService.resetPassword(dto.token, dto.newPassword);
        return { message: 'Password reset successfully' };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async me(@Req() req: Request) {
        const user = (req as any).user;
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            fullNameAr: user.fullNameAr,
            role: user.role,
            governorate: user.governorate,
            mustChangePass: user.mustChangePass,
            department: user.department,
            profileImage: user.profileImage,
            employeeNumber: user.employeeNumber,
            jobTitle: user.jobTitle,
            jobTitleAr: user.jobTitleAr,
        };
    }

    @Get('csrf')
    @HttpCode(HttpStatus.OK)
    getCsrfToken(@Req() req: Request) {
        const token = (req as Request & { csrfToken: () => string }).csrfToken();
        return { csrfToken: token };
    }
}
