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
        isSuperAdmin?: boolean;
        isApproved?: boolean;
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
            include: {
                ctCenter: true,
                userInCTCenters: {
                    include: { ctCenter: true },
                    orderBy: { createdAt: 'asc' },
                },
            },
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

        // Use UserInCTCenter as source of truth for the default center
        const defaultMembership = user.userInCTCenters[0];
        const loginUser = {
            ...user,
            ctCenterId: user.ctCenterId || defaultMembership?.ctCenterId || null,
            ctCenter: user.ctCenter || defaultMembership?.ctCenter || null,
            // For super admins, keep user.role (SUPER_ADMIN); for others, use membership role
            role: user.isSuperAdmin ? user.role : (defaultMembership?.role || user.role),
        };
        return this.generateTokens(loginUser);
    }

    async register(dto: RegisterDto): Promise<TokenResponse> {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // If centerName is provided, create a new CT center + CT_ADMIN user
        if (dto.centerName) {
            const slug = dto.centerName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                + '-' + Date.now().toString(36);

            const user = await this.prisma.user.create({
                data: {
                    email: dto.email,
                    password: hashedPassword,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    phone: dto.phone,
                    role: UserRole.CT_ADMIN,
                    isActive: true,
                },
            });

            const center = await this.prisma.cTCenter.create({
                data: {
                    name: dto.centerName,
                    slug,
                    address: '',
                    city: '',
                    postalCode: '',
                    phone: dto.phone || '',
                    email: dto.email,
                    ownerId: user.id,
                    isApproved: false, // Requires super admin approval
                },
            });

            // Link user to center
            await this.prisma.user.update({
                where: { id: user.id },
                data: { ctCenterId: center.id },
            });

            await this.prisma.userInCTCenter.create({
                data: {
                    userId: user.id,
                    ctCenterId: center.id,
                    role: UserRole.CT_ADMIN,
                },
            });

            const fullUser = await this.prisma.user.findUnique({
                where: { id: user.id },
                include: { ctCenter: true },
            });

            return this.generateTokens(fullUser);
        }

        // Default: create a regular CLIENT user (no center)
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
                userInCTCenters: {
                    include: {
                        ctCenter: { select: { id: true, name: true, slug: true, logo: true } },
                    },
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException('المستخدم غير موجود');
        }

        // Build list of accessible centers
        const centers: { id: string; name: string; slug: string; logo: string | null; role?: UserRole }[] = [];

        // For super admins, show ALL active centers
        if (user.isSuperAdmin) {
            const allCenters = await this.prisma.cTCenter.findMany({
                where: { isActive: true, deletedAt: null },
                select: { id: true, name: true, slug: true, logo: true },
            });
            for (const c of allCenters) {
                centers.push(c);
            }
        } else {
            // Add centers from userInCTCenters (primary source)
            for (const uc of user.userInCTCenters) {
                if (!centers.find(x => x.id === uc.ctCenter.id)) {
                    centers.push({ ...uc.ctCenter, role: uc.role });
                }
            }

            // If user belongs to a center directly via legacy field, include it
            if (user.ctCenter && !centers.find(x => x.id === user.ctCenter!.id)) {
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
        }

        // Determine current center — use JWT/ctCenterId or fall back to first membership
        const currentCenterId = user.ctCenterId || user.userInCTCenters[0]?.ctCenterId || null;

        const { password, passwordResetToken, passwordResetExpires, ...profile } = user;
        return {
            user: profile,
            currentCenterId,
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
                userInCTCenters: { select: { ctCenterId: true, role: true } },
            },
        });

        if (!user) {
            throw new UnauthorizedException('المستخدم غير موجود');
        }

        const memberRecord = user.userInCTCenters.find(uc => uc.ctCenterId === ctCenterId);
        const hasAccess =
            user.isSuperAdmin ||
            user.ownedCenters.some(c => c.id === ctCenterId) ||
            !!memberRecord ||
            user.ctCenterId === ctCenterId;

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

        // Determine the user's role in this center
        const centerRole = memberRecord?.role
            || (user.ownedCenters.some(c => c.id === ctCenterId) ? UserRole.CT_ADMIN : user.role);

        // Generate new tokens with the selected ctCenterId
        return this.generateTokens({ ...user, ctCenterId, ctCenter: center, role: centerRole });
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return; // Don't reveal if email exists
        }

        // Generate 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedOtp,
                passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
            },
        });

        // TODO: Send email with OTP via EmailService
        console.log(`Password reset OTP for ${email}: ${otp}`);
    }

    async verifyResetCode(email: string, code: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
            throw new BadRequestException('رمز التحقق غير صالح أو منتهي');
        }

        if (user.passwordResetExpires < new Date()) {
            throw new BadRequestException('رمز التحقق منتهي الصلاحية');
        }

        const isValid = await bcrypt.compare(code, user.passwordResetToken);
        if (!isValid) {
            throw new BadRequestException('رمز التحقق غير صحيح');
        }
    }

    async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
            throw new BadRequestException('رمز التحقق غير صالح أو منتهي');
        }

        if (user.passwordResetExpires < new Date()) {
            throw new BadRequestException('رمز التحقق منتهي الصلاحية');
        }

        const isValid = await bcrypt.compare(code, user.passwordResetToken);
        if (!isValid) {
            throw new BadRequestException('رمز التحقق غير صحيح');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: user.id },
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
        const domain = isProduction ? '.agendact.com' : undefined;

        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000, // 15 minutes
            path: '/',
            domain,
        });

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/auth',
            domain,
        });
    }

    clearAuthCookies(res: Response) {
        const isProduction = this.configService.get('NODE_ENV') === 'production';
        const domain = isProduction ? '.agendact.com' : undefined;

        res.clearCookie('accessToken', { path: '/', domain });
        res.clearCookie('refreshToken', { path: '/auth', domain });
    }

    private async generateTokens(user: any): Promise<TokenResponse> {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            ctCenterId: user.ctCenterId || undefined,
            isSuperAdmin: user.isSuperAdmin || false,
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
                isSuperAdmin: user.isSuperAdmin || false,
                isApproved: user.ctCenter?.isApproved ?? true,
            },
        };
    }
}
