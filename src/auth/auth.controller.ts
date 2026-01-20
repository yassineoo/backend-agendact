import {
    Controller,
    Post,
    Body,
    Get,
    Patch,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
    LoginDto,
    RegisterDto,
    RefreshTokenDto,
    ForgotPasswordDto,
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
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshToken(dto.refreshToken);
    }

    @Post('logout')
    @UseGuards(AuthGuard('jwt'))
    @HttpCode(HttpStatus.OK)
    async logout(@CurrentUser() user: any, @Body() dto?: RefreshTokenDto) {
        await this.authService.logout(user.id, dto?.refreshToken);
        return { message: 'تم تسجيل الخروج بنجاح' };
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        await this.authService.forgotPassword(dto.email);
        return { message: 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني' };
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        await this.authService.resetPassword(dto.token, dto.password);
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
