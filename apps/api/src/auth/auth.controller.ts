import {
    Controller,
    Post,
    Body,
    Patch,
    Req,
    Res,
    UseGuards,
    HttpCode,
    HttpStatus,
    Get,
} from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto, ResetPasswordRequestDto, ResetPasswordDto, RegisterDto, UpdateWorkflowModeDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { getCookieSettings } from '../shared/cookie-settings';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    private applyPrivateNoStore(res: Response) {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    private getCookieAges(rememberMe = false) {
        const accessMs = 15 * 60 * 1000; // 15m
        const refreshMs = 7 * 24 * 60 * 60 * 1000;

        return {
            accessMs,
            refreshMs,
        };
    }

    private getHttpOnlyCookieOptions(maxAge: number): CookieOptions {
        const { sameSite, secure, domain, path } = getCookieSettings();

        return {
            httpOnly: true,
            secure,
            sameSite,
            maxAge,
            path,
            ...(domain ? { domain } : {}),
        };
    }


    private getSessionHintCookieOptions(maxAge?: number): CookieOptions {
        const { sameSite, secure, domain, path } = getCookieSettings();

        return {
            httpOnly: false,
            secure,
            sameSite,
            path,
            ...(typeof maxAge === 'number' ? { maxAge } : {}),
            ...(domain ? { domain } : {}),
        };
    }

    private getClearCookieOptions(): CookieOptions {
        const { sameSite, secure, domain, path } = getCookieSettings();

        return {
            httpOnly: true,
            secure,
            sameSite,
            path,
            ...(domain ? { domain } : {}),
        };
    }

    @Post('login')
    @UseGuards(ThrottlerGuard)
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        this.applyPrivateNoStore(res);
        const rememberMe = !!dto.rememberMe;
        const result = await this.authService.login(
            dto.identifier,
            dto.password,
            rememberMe,
            req.ip,
            req.headers['user-agent'],
        );
        const ages = this.getCookieAges(rememberMe);

        // Set HttpOnly cookies
        res.cookie('access_token', result.accessToken, this.getHttpOnlyCookieOptions(ages.accessMs));
        res.cookie('refresh_token', result.refreshToken, this.getHttpOnlyCookieOptions(ages.refreshMs));

        if (rememberMe) {
            res.cookie('remember_me', '1', this.getHttpOnlyCookieOptions(ages.refreshMs));
        } else {
            res.clearCookie('remember_me', this.getClearCookieOptions());
        }

        res.cookie('sphinx_session', '1', this.getSessionHintCookieOptions(ages.refreshMs));

        return { user: result.user, accessToken: result.accessToken };
    }

    @Get('registration-options')
    async getRegistrationOptions() {
        return this.authService.getRegistrationOptions();
    }

    @Post('register')
    @UseGuards(ThrottlerGuard)
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        this.applyPrivateNoStore(res);
        const result = await this.authService.register(dto, req.ip, req.headers['user-agent']);
        const ages = this.getCookieAges(false);

        res.cookie('access_token', result.accessToken, this.getHttpOnlyCookieOptions(ages.accessMs));
        res.cookie('refresh_token', result.refreshToken, this.getHttpOnlyCookieOptions(ages.refreshMs));
        res.clearCookie('remember_me', this.getClearCookieOptions());
        res.cookie('sphinx_session', '1', this.getSessionHintCookieOptions(ages.refreshMs));

        return {
            user: result.user,
            accessToken: result.accessToken,
            emailDelivery: result.emailDelivery,
            whatsAppDelivery: result.whatsAppDelivery,
        };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        this.applyPrivateNoStore(res);
        const refreshToken = req.cookies?.refresh_token;
        await this.authService.logout((req as any).user?.id, refreshToken);

        const clearCookieOptions = this.getClearCookieOptions();
        res.clearCookie('access_token', clearCookieOptions);
        res.clearCookie('refresh_token', clearCookieOptions);
        res.clearCookie('remember_me', clearCookieOptions);
        res.clearCookie('sphinx_session', this.getSessionHintCookieOptions());

        return { message: 'Logged out successfully' };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        this.applyPrivateNoStore(res);
        const refreshToken = req.cookies?.refresh_token;
        const rememberMe = req.cookies?.remember_me === '1';
        const tokens = await this.authService.refreshTokens(
            refreshToken,
            rememberMe,
            req.ip,
            req.headers['user-agent'],
        );
        const ages = this.getCookieAges(rememberMe);

        res.cookie('access_token', tokens.accessToken, this.getHttpOnlyCookieOptions(ages.accessMs));
        res.cookie('refresh_token', tokens.refreshToken, this.getHttpOnlyCookieOptions(ages.refreshMs));
        res.cookie('sphinx_session', '1', this.getSessionHintCookieOptions(ages.refreshMs));

        return { accessToken: tokens.accessToken };
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

    @Patch('workflow-mode')
    @UseGuards(JwtAuthGuard)
    async updateWorkflowMode(@Body() dto: UpdateWorkflowModeDto, @Req() req: Request) {
        const user = await this.authService.updateWorkflowMode((req as any).user.id, dto.workflowMode);
        return { user };
    }

    @Post('forgot-password')
    @UseGuards(ThrottlerGuard)
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ResetPasswordRequestDto) {
        await this.authService.requestPasswordReset(dto.identifier || dto.email, dto.locale);
        return { message: 'If the account exists, a reset code has been sent.' };
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
        this.applyPrivateNoStore(res);
        const result = await this.authService.resetPassword(dto.token, dto.newPassword, dto.identifier);
        const ages = this.getCookieAges(false);

        res.cookie('access_token', result.accessToken, this.getHttpOnlyCookieOptions(ages.accessMs));
        res.cookie('refresh_token', result.refreshToken, this.getHttpOnlyCookieOptions(ages.refreshMs));
        res.clearCookie('remember_me', this.getClearCookieOptions());
        res.cookie('sphinx_session', '1', this.getSessionHintCookieOptions(ages.refreshMs));

        return {
            message: 'Password reset successfully',
            user: result.user,
            accessToken: result.accessToken,
        };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        this.applyPrivateNoStore(res);
        const user = (req as any).user;
        return {
            id: user.id,
            email: user.email,
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
            phone: user.phone,
        };
    }

    @Get('csrf')
    @HttpCode(HttpStatus.OK)
    getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        this.applyPrivateNoStore(res);
        const token = (req as Request & { csrfToken: () => string }).csrfToken();
        return { csrfToken: token };
    }
}
