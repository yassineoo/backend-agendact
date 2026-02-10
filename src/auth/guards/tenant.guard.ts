import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('المستخدم غير مصادق');
        }

        if (!user.ctCenterId) {
            throw new ForbiddenException('لم يتم تحديد مركز الفحص التقني');
        }

        return true;
    }
}
