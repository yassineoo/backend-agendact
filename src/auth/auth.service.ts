import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ChangePasswordDto, UpdateProfileDto } from './dto';
import { UserRole } from '@prisma/client';
import { Response } from 'express';

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
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

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
            await this.prisma.refreshToken.deleteMany({
                where: { userId },
            });
        }
    }

    async getSession(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                ctCenter: true,
                ownedCenters: { select: { id: true, name: true, slug: true, logo: true } },
            },
        });

        if (!user) {
            throw new UnauthorizedException('المستخدم غير موجود');
        }

        // Build list of accessible centers
        const centers: { id: string; name: string; slug: string; logo: string | null }[] = [];

        // If user belongs to a center, include it
        if (user.ctCenter) {
            centers.push({
                id: user.ctCenter.id,
                name: user.ctCenter.name,
                slug: user.ctCenter.slug,
                logo: user.ctCenter.logo,
            });
        }

        // Add owned centers
        for (const c of user.ownedCenters) {
            if (!centers.find(x => x.id === c.id)) {
                centers.push(c);
            }
        }

        const { password, passwordResetToken, passwordResetExpires, ...profile } = user;
        return {
            user: profile,
            currentCenterId: user.ctCenterId,
            centers,
        };
    }

    async switchCenter(userId: string, ctCenterId: string): Promise<TokenResponse> {
        // Verify user has access to this center
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                ctCenter: true,
                ownedCenters: { select: { id: true } },
            },
        });

        if (!user) {
            throw new UnauthorizedException('المستخدم غير موجود');
        }

        const hasAccess =
            user.ctCenterId === ctCenterId ||
            user.ownedCenters.some(c => c.id === ctCenterId) ||
            user.role === UserRole.SUPER_ADMIN;

        if (!hasAccess) {
            throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المركز');
        }

        // Get the center info
        const center = await this.prisma.cTCenter.findUnique({
            where: { id: ctCenterId },
        });

        if (!center) {
            throw new BadRequestException('المركز غير موجود');
        }

        // Generate new tokens with the selected ctCenterId
        return this.generateTokens({ ...user, ctCenterId, ctCenter: center });
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return; // Don't reveal if email exists
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(resetToken, 10);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpires: new Date(Date.now() + 3600000),
            },
        });

        // TODO: Send email with reset link via EmailService
        console.log(`Password reset token for ${email}: ${resetToken}`);
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
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

        const { password, passwordResetToken, passwordResetExpires, ...profile } = user;
        return profile;
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: dto,
            include: { ctCenter: true },
        });

        const { password, passwordResetToken, passwordResetExpires, ...profile } = user;
        return profile;
    }

    // === Cookie helpers ===

    setAuthCookies(res: Response, tokens: TokenResponse) {
        const isProduction = this.configService.get('NODE_ENV') === 'production';

        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000, // 15 minutes
            path: '/',
        });

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/api/auth',
        });
    }

    clearAuthCookies(res: Response) {
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/api/auth' });
    }

    private async generateTokens(user: any): Promise<TokenResponse> {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            ctCenterId: user.ctCenterId || undefined,
        };

        const accessToken = this.jwtService.sign(payload);

        const refreshToken = crypto.randomBytes(64).toString('hex');

        // Store refresh token
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: 900,
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
