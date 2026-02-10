import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    ctCenterId?: string;
}

// Extract JWT from cookie first, then Authorization header as fallback
function extractJwt(req: Request): string | null {
    // 1. Try cookie
    const cookieToken = req?.cookies?.accessToken;
    if (cookieToken) return cookieToken;

    // 2. Fallback to Bearer header
    return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private prisma: PrismaService,
        configService: ConfigService,
    ) {
        super({
            jwtFromRequest: extractJwt,
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-change-me',
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: { ctCenter: true },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('المستخدم غير موجود أو غير نشط');
        }

        // Return full user object with ctCenterId from JWT payload
        // (JWT ctCenterId takes priority — allows center switching)
        return {
            ...user,
            ctCenterId: payload.ctCenterId || user.ctCenterId,
        };
    }
}
