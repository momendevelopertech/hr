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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @UseGuards(ThrottlerGuard)
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(
            dto.email,
            dto.password,
            req.ip,
            req.headers['user-agent'],
        );

        // Set HttpOnly cookies
        res.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

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

        return { message: 'Logged out successfully' };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const refreshToken = req.cookies?.refresh_token;
        const tokens = await this.authService.refreshTokens(refreshToken);

        res.cookie('access_token', tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refresh_token', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
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
            fullName: user.fullName,
            fullNameAr: user.fullNameAr,
            role: user.role,
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
