import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

@Injectable()
export class VehiclesService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, clientId?: string) {
        return this.prisma.vehicle.findMany({
            where: {
                ctCenterId,
                ...(clientId ? { clientId } : {}),
                deletedAt: null,
            },
            include: {
                client: { select: { id: true, firstName: true, lastName: true } },
                _count: { select: { reservations: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(ctCenterId: string, id: string) {
        const vehicle = await this.prisma.vehicle.findFirst({
            where: { id, ctCenterId, deletedAt: null },
            include: {
                client: true,
                reservations: {
                    take: 10,
                    orderBy: { date: 'desc' },
                    include: { category: true },
                },
            },
        });

        if (!vehicle) {
            throw new NotFoundException('المركبة غير موجودة');
        }

        return vehicle;
    }

    async create(ctCenterId: string, dto: CreateVehicleDto) {
        // Check for duplicate plate
        const existing = await this.prisma.vehicle.findFirst({
            where: { ctCenterId, plateNumber: dto.plateNumber, deletedAt: null },
        });

        if (existing) {
            throw new ConflictException('مركبة بهذا الرقم موجودة بالفعل');
        }

        return this.prisma.vehicle.create({
            data: { ...dto, ctCenterId },
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdateVehicleDto) {
        await this.findOne(ctCenterId, id);

        return this.prisma.vehicle.update({
            where: { id },
            data: dto,
        });
    }

    async remove(ctCenterId: string, id: string) {
        await this.findOne(ctCenterId, id);

        await this.prisma.vehicle.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async getHistory(ctCenterId: string, id: string) {
        const vehicle = await this.findOne(ctCenterId, id);

        const reservations = await this.prisma.reservation.findMany({
            where: { vehicleId: id },
            include: { category: true },
            orderBy: { date: 'desc' },
        });

        return {
            vehicle,
            history: reservations,
        };
    }
}
