import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
    email: string;

    @IsString()
    @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
    password: string;

    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
}

export class RegisterDto {
    @IsString()
    @MinLength(2, { message: 'الاسم الأول يجب أن يكون حرفين على الأقل' })
    firstName: string;

    @IsString()
    @MinLength(2, { message: 'الاسم الأخير يجب أن يكون حرفين على الأقل' })
    lastName: string;

    @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
    email: string;

    @IsString()
    @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    password: string;

    @IsOptional()
    @IsString()
    phone?: string;
}

export class RefreshTokenDto {
    @IsString()
    refreshToken: string;
}

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
    email: string;
}

export class VerifyResetCodeDto {
    @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
    code: string;
}

export class ResetPasswordDto {
    @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
    code: string;

    @IsString()
    @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
    newPassword: string;
}

export class ChangePasswordDto {
    @IsString()
    currentPassword: string;

    @IsString()
    @MinLength(8, { message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' })
    newPassword: string;
}

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    lastName?: string;

    @IsOptional()
    @IsString()
    phone?: string;
}
