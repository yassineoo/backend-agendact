import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ChangePasswordDto, UpdateProfileDto } from './dto';
import { UserRole } from '@prisma/client';

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: UserRole;
        avatar?: string;
        ctCenterId?: string;
        ctCenterName?: string;
    };
}

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async login(dto: LoginDto): Promise<TokenResponse> {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { ctCenter: true },
        });

        if (!user) {
            throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('الحساب معطل');
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        return this.generateTokens(user);
    }

    async register(dto: RegisterDto): Promise<TokenResponse> {
        // Check if email exists
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                role: UserRole.CLIENT,
                isActive: true,
            },
        });

        return this.generateTokens(user);
    }

    async refreshToken(refreshToken: string): Promise<TokenResponse> {
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: { include: { ctCenter: true } } },
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            throw new UnauthorizedException('Refresh token غير صالح أو منتهي');
        }

        // Delete old token
        await this.prisma.refreshToken.delete({
            where: { id: storedToken.id },
        });

        return this.generateTokens(storedToken.user);
    }

    async logout(userId: string, refreshToken?: string): Promise<void> {
        if (refreshToken) {
            await this.prisma.refreshToken.deleteMany({
                where: { token: refreshToken },
            });
        } else {
            // Delete all refresh tokens for user
            await this.prisma.refreshToken.deleteMany({
                where: { userId },
            });
        }
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Don't reveal if email exists
            return;
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(resetToken, 10);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
            },
        });

        // TODO: Send email with reset link
        console.log(`Password reset token for ${email}: ${resetToken}`);
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        // Find user with valid reset token
        const users = await this.prisma.user.findMany({
            where: {
                passwordResetExpires: { gt: new Date() },
                passwordResetToken: { not: null },
            },
        });

        let validUserId: string | null = null;
        for (const user of users) {
            if (user.passwordResetToken) {
                const isValid = await bcrypt.compare(token, user.passwordResetToken);
                if (isValid) {
                    validUserId = user.id;
                    break;
                }
            }
        }

        if (!validUserId) {
            throw new BadRequestException('رابط إعادة التعيين غير صالح أو منتهي');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: validUserId },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });
    }

    async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException('المستخدم غير موجود');
        }

        const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
        }

        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { ctCenter: true },
        });

        if (!user) {
            throw new UnauthorizedException('المستخدم غير موجود');
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, passwordResetToken, passwordResetExpires, ...profile } = user;
        return profile;
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: dto,
            include: { ctCenter: true },
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, passwordResetToken, passwordResetExpires, ...profile } = user;
        return profile;
    }

    private async generateTokens(user: any): Promise<TokenResponse> {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = this.jwtService.sign(payload);

        const refreshToken = crypto.randomBytes(64).toString('hex');

        // Store refresh token
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes in seconds
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                avatar: user.avatar || undefined,
                ctCenterId: user.ctCenterId || undefined,
                ctCenterName: user.ctCenter?.name,
            },
        };
    }
}
