import {
    Controller,
    Post,
    Body,
    Get,
    Patch,
    UseGuards,
    HttpCode,
    HttpStatus,
    Res,
    Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import {
    LoginDto,
    RegisterDto,
    RefreshTokenDto,
    ForgotPasswordDto,
    VerifyResetCodeDto,
    ResetPasswordDto,
    ChangePasswordDto,
    UpdateProfileDto,
} from './dto';
import { CurrentUser } from './decorators';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const tokens = await this.authService.login(dto);
        this.authService.setAuthCookies(res, tokens);
        return tokens;
    }

    @Post('register')
    async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
        const tokens = await this.authService.register(dto);
        this.authService.setAuthCookies(res, tokens);
        return tokens;
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Body() dto: RefreshTokenDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        // Try cookie first, then body
        const refreshToken = req.cookies?.refreshToken || dto?.refreshToken;
        if (!refreshToken) {
            return { error: 'No refresh token provided' };
        }
        const tokens = await this.authService.refreshToken(refreshToken);
        this.authService.setAuthCookies(res, tokens);
        return tokens;
    }

    @Post('logout')
    @UseGuards(AuthGuard('jwt'))
    @HttpCode(HttpStatus.OK)
    async logout(
        @CurrentUser() user: any,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() dto?: RefreshTokenDto,
    ) {
        const refreshToken = req.cookies?.refreshToken || dto?.refreshToken;
        await this.authService.logout(user.id, refreshToken);
        this.authService.clearAuthCookies(res);
        return { message: 'تم تسجيل الخروج بنجاح' };
    }

    @Get('session')
    @UseGuards(AuthGuard('jwt'))
    async getSession(@CurrentUser() user: any) {
        return this.authService.getSession(user.id);
    }

    @Post('switch-center')
    @UseGuards(AuthGuard('jwt'))
    @HttpCode(HttpStatus.OK)
    async switchCenter(
        @CurrentUser() user: any,
        @Body() dto: { ctCenterId: string },
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.switchCenter(user.id, dto.ctCenterId);
        this.authService.setAuthCookies(res, tokens);
        return tokens;
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        await this.authService.forgotPassword(dto.email);
        return { message: 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني' };
    }

    @Post('verify-reset-code')
    @HttpCode(HttpStatus.OK)
    async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
        await this.authService.verifyResetCode(dto.email, dto.code);
        return { message: 'رمز التحقق صحيح' };
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        await this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
        return { message: 'تم إعادة تعيين كلمة المرور بنجاح' };
    }

    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    async getProfile(@CurrentUser() user: any) {
        return this.authService.getProfile(user.id);
    }

    @Patch('me')
    @UseGuards(AuthGuard('jwt'))
    async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
        return this.authService.updateProfile(user.id, dto);
    }

    @Patch('me/password')
    @UseGuards(AuthGuard('jwt'))
    async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
        await this.authService.changePassword(user.id, dto);
        return { message: 'تم تغيير كلمة المرور بنجاح' };
    }
}
