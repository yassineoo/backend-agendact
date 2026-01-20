import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto, PaymentFilterDto, ProcessRefundDto } from './dto';
import { PaymentStatus, InvoiceStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, filter: PaymentFilterDto) {
        const where: any = {
            ctCenterId,
        };

        if (filter.dateFrom) {
            where.createdAt = { ...where.createdAt, gte: new Date(filter.dateFrom) };
        }
        if (filter.dateTo) {
            where.createdAt = { ...where.createdAt, lte: new Date(filter.dateTo) };
        }
        if (filter.status) where.status = filter.status;
        if (filter.method) where.method = filter.method;
        if (filter.clientId) {
            where.reservation = { clientId: filter.clientId };
        }

        const [total, items] = await Promise.all([
            this.prisma.payment.count({ where }),
            this.prisma.payment.findMany({
                where,
                include: {
                    reservation: {
                        include: {
                            client: { select: { id: true, firstName: true, lastName: true } },
                            category: { select: { id: true, name: true } },
                        },
                    },
                    invoice: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: ((filter.page || 1) - 1) * (filter.limit || 20),
                take: filter.limit || 20,
            }),
        ]);

        return {
            items,
            total,
            page: filter.page || 1,
            limit: filter.limit || 20,
            totalPages: Math.ceil(total / (filter.limit || 20)),
        };
    }

    async findOne(ctCenterId: string, id: string) {
        const payment = await this.prisma.payment.findFirst({
            where: { id, ctCenterId },
            include: {
                reservation: {
                    include: {
                        client: true,
                        category: true,
                        vehicle: true,
                    },
                },
                invoice: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('الدفعة غير موجودة');
        }

        return payment;
    }

    async create(ctCenterId: string, dto: CreatePaymentDto, userId: string) {
        // Validate reservation
        const reservation = await this.prisma.reservation.findFirst({
            where: { id: dto.reservationId, ctCenterId, deletedAt: null },
            include: { category: true, client: true },
        });

        if (!reservation) {
            throw new BadRequestException('الحجز غير موجود');
        }

        return this.prisma.$transaction(async (tx) => {
            // Create payment
            const payment = await tx.payment.create({
                data: {
                    ctCenterId,
                    reservationId: dto.reservationId,
                    amount: dto.amount,
                    method: dto.method,
                    status: PaymentStatus.PENDING,
                    notes: dto.notes,
                },
                include: {
                    reservation: {
                        include: { client: true, category: true },
                    },
                },
            });

            // Generate invoice number
            const invoiceCount = await tx.invoice.count({ where: { ctCenterId } });
            const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(6, '0')}`;

            // Create invoice
            await tx.invoice.create({
                data: {
                    ctCenterId,
                    paymentId: payment.id,
                    clientId: reservation.clientId,
                    number: invoiceNumber,
                    subtotal: dto.amount,
                    taxRate: 20,
                    taxAmount: 0,
                    total: dto.amount,
                    status: InvoiceStatus.DRAFT,
                    items: [
                        {
                            description: reservation.category.name,
                            quantity: 1,
                            unitPrice: Number(reservation.category.price),
                            total: dto.amount,
                        },
                    ],
                },
            });

            return payment;
        });
    }

    async markAsPaid(ctCenterId: string, id: string, transactionId?: string) {
        await this.findOne(ctCenterId, id);

        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { id },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                    transactionId,
                },
            });

            await tx.invoice.updateMany({
                where: { paymentId: id },
                data: {
                    status: InvoiceStatus.PAID,
                    paidAt: new Date(),
                },
            });

            return payment;
        });
    }

    async processRefund(ctCenterId: string, id: string, dto: ProcessRefundDto) {
        const payment = await this.findOne(ctCenterId, id);

        if (payment.status !== PaymentStatus.PAID) {
            throw new BadRequestException('لا يمكن استرداد دفعة غير مدفوعة');
        }

        if (dto.amount > Number(payment.amount)) {
            throw new BadRequestException('مبلغ الاسترداد أكبر من المبلغ المدفوع');
        }

        return this.prisma.$transaction(async (tx) => {
            const updatedPayment = await tx.payment.update({
                where: { id },
                data: {
                    status: PaymentStatus.REFUNDED,
                    notes: `[استرداد] ${dto.reason} - المبلغ: ${dto.amount}`,
                },
            });

            await tx.invoice.updateMany({
                where: { paymentId: id },
                data: {
                    status: InvoiceStatus.CANCELLED,
                },
            });

            return updatedPayment;
        });
    }

    async getStats(ctCenterId: string, period: 'day' | 'week' | 'month' | 'year' = 'month') {
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
        }

        const [totalRevenue, paymentsByMethod, paymentsByStatus] = await Promise.all([
            this.prisma.payment.aggregate({
                where: {
                    ctCenterId,
                    status: PaymentStatus.PAID,
                    paidAt: { gte: startDate },
                },
                _sum: { amount: true },
                _count: true,
            }),
            this.prisma.payment.groupBy({
                by: ['method'],
                where: {
                    ctCenterId,
                    status: PaymentStatus.PAID,
                    paidAt: { gte: startDate },
                },
                _sum: { amount: true },
                _count: true,
            }),
            this.prisma.payment.groupBy({
                by: ['status'],
                where: {
                    ctCenterId,
                    createdAt: { gte: startDate },
                },
                _count: true,
            }),
        ]);

        return {
            period,
            totalRevenue: Number(totalRevenue._sum?.amount || 0),
            totalPayments: totalRevenue._count,
            byMethod: paymentsByMethod.map((p) => ({
                method: p.method,
                amount: Number(p._sum?.amount || 0),
                count: p._count,
            })),
            byStatus: paymentsByStatus.reduce((acc, p) => ({ ...acc, [p.status]: p._count }), {}),
        };
    }
}
