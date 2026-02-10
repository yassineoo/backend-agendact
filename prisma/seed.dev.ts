import {
    PrismaClient, UserRole, SubscriptionStatus, ClientType, VehicleType,
    FuelType, ReservationStatus, PaymentMethod, PaymentStatus, InvoiceStatus,
    EmailTemplateType, DiscountType, NotificationType, SmsProvider, InspectionResult,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────────
const hash = (pw: string) => bcrypt.hash(pw, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);
const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const setTime = (d: Date, h: number, m = 0) => { const r = new Date(d); r.setHours(h, m, 0, 0); return r; };
let bookingSeq = 1000;
const nextBookingCode = () => `RES-DEV-${++bookingSeq}`;
let invoiceSeq = 2000;
const nextInvoiceNumber = () => `INV-${new Date().getFullYear()}-${++invoiceSeq}`;

async function main() {
    console.log('🌱 Starting DEVELOPMENT seed...');
    console.log('🗑️  Clearing all data...');

    // Delete in dependency order
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.document.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.smsUsage.deleteMany();
    await prisma.sMSTemplate.deleteMany();
    await prisma.emailTemplate.deleteMany();
    await prisma.landingPage.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.promotion.deleteMany();
    await prisma.holiday.deleteMany();
    await prisma.category.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.client.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.systemSetting.deleteMany();
    await prisma.user.deleteMany();
    await prisma.cTCenter.deleteMany();
    console.log('✅ Cleared');

    // ─── 1. SYSTEM SETTINGS ──────────────────────────────────────────
    const sysSettings = [
        { key: 'platform_name', value: 'AgendaCT', label: 'Nom de la plateforme' },
        { key: 'platform_url', value: 'http://localhost:3000', label: 'URL plateforme' },
        { key: 'support_email', value: 'support@agendact.com', label: 'Email support' },
        { key: 'email_provider', value: 'sweego', label: 'Fournisseur email' },
        { key: 'email_from', value: 'no-reply@agendact.com', label: 'Email expéditeur' },
        { key: 'email_from_name', value: 'AgendaCT Dev', label: 'Nom expéditeur' },
        { key: 'maintenance_mode', value: false, label: 'Mode maintenance' },
        { key: 'default_trial_days', value: 14, label: 'Jours d\'essai' },
        { key: 'max_centers_per_admin', value: 5, label: 'Max centres par admin' },
        { key: 'sms_global_quota', value: 10000, label: 'Quota SMS global' },
    ];
    for (const s of sysSettings) {
        await prisma.systemSetting.create({ data: { key: s.key, value: s.value as any, label: s.label } });
    }
    console.log('⚙️  Created', sysSettings.length, 'system settings');

    // ─── 2. SUBSCRIPTION PLANS ───────────────────────────────────────
    const [starterPlan, proPlan, enterprisePlan] = await Promise.all([
        prisma.subscriptionPlan.create({
            data: {
                name: 'Starter', description: 'Plan pour petits centres', price: 29.99, duration: 30,
                features: JSON.stringify(['3 utilisateurs', 'Réservations', 'Clients', 'Support email']),
                maxUsers: 3, maxVehicles: 50, isActive: true, sortOrder: 1,
            },
        }),
        prisma.subscriptionPlan.create({
            data: {
                name: 'Professional', description: 'Pour centres moyens', price: 79.99, duration: 30,
                features: JSON.stringify(['10 utilisateurs', 'Statistiques', 'SMS/Email', 'Support prioritaire']),
                maxUsers: 10, maxVehicles: 200, isActive: true, sortOrder: 2,
            },
        }),
        prisma.subscriptionPlan.create({
            data: {
                name: 'Enterprise', description: 'Solution complète', price: 149.99, duration: 30,
                features: JSON.stringify(['Illimité', 'API', 'Page perso', 'Manager dédié', 'Formation']),
                maxUsers: 100, maxVehicles: null, isActive: true, sortOrder: 3,
            },
        }),
    ]);
    console.log('📦 Created 3 subscription plans');

    // ─── 3. SUPER ADMIN ──────────────────────────────────────────────
    const superAdmin = await prisma.user.create({
        data: {
            email: 'admin@agendact.com', password: await hash('SuperAdmin123!'),
            firstName: 'Super', lastName: 'Admin', phone: '+33600000000',
            role: UserRole.SUPER_ADMIN, isActive: true, emailVerified: true,
            lastLogin: daysAgo(0),
        },
    });
    console.log('👤 Super Admin:', superAdmin.email);

    // ─── 4. CENTER 1: "Auto Plus" (Paris) — active, Professional ────
    const admin1 = await prisma.user.create({
        data: {
            email: 'jean.dupont@auto-plus.fr', password: await hash('CTAdmin123!'),
            firstName: 'Jean', lastName: 'Dupont', phone: '+33612345678',
            role: UserRole.CT_ADMIN, isActive: true, emailVerified: true,
            lastLogin: daysAgo(1),
        },
    });

    const center1 = await prisma.cTCenter.create({
        data: {
            name: 'Contrôle Technique Auto Plus', slug: 'auto-plus',
            address: '123 Avenue de la République', city: 'Paris', postalCode: '75011',
            phone: '+33145678900', email: 'contact@auto-plus-ct.fr',
            siren: '123456789', siret: '12345678900012', approvalNumber: 'CT-75011-001',
            brand: 'Dekra', description: 'Centre agréé depuis 2010. Équipe expérimentée.',
            latitude: 48.8588443, longitude: 2.3700138,
            timezone: 'Europe/Paris', currency: 'EUR',
            openingHours: JSON.stringify({
                monday: { open: '08:00', close: '18:00', closed: false },
                tuesday: { open: '08:00', close: '18:00', closed: false },
                wednesday: { open: '08:00', close: '18:00', closed: false },
                thursday: { open: '08:00', close: '18:00', closed: false },
                friday: { open: '08:00', close: '17:00', closed: false },
                saturday: { open: '09:00', close: '13:00', closed: false },
                sunday: { open: '00:00', close: '00:00', closed: true },
            }),
            isActive: true, ownerId: admin1.id,
            smsProvider: SmsProvider.SWEEGO, smsSenderName: 'AutoPlus',
        },
    });
    await prisma.user.update({ where: { id: admin1.id }, data: { ctCenterId: center1.id } });
    console.log('🏢 Center 1:', center1.name);

    // Employees for center 1
    const [emp1, emp2, emp3] = await Promise.all([
        prisma.user.create({
            data: {
                email: 'pierre.martin@auto-plus.fr', password: await hash('Employee123!'),
                firstName: 'Pierre', lastName: 'Martin', phone: '+33612345679',
                role: UserRole.EMPLOYEE, ctCenterId: center1.id, isActive: true, emailVerified: true,
            },
        }),
        prisma.user.create({
            data: {
                email: 'marie.dubois@auto-plus.fr', password: await hash('Employee123!'),
                firstName: 'Marie', lastName: 'Dubois', phone: '+33612345680',
                role: UserRole.EMPLOYEE, ctCenterId: center1.id, isActive: true, emailVerified: true,
            },
        }),
        prisma.user.create({
            data: {
                email: 'luc.moreau@auto-plus.fr', password: await hash('Employee123!'),
                firstName: 'Luc', lastName: 'Moreau', phone: '+33612345699',
                role: UserRole.EMPLOYEE, ctCenterId: center1.id, isActive: false, emailVerified: true,
                deletedAt: daysAgo(5), // Edge case: soft-deleted employee
            },
        }),
    ]);
    console.log('👥 Created 3 employees for center 1 (1 inactive)');

    // Subscription for center 1
    const sub1 = await prisma.subscription.create({
        data: {
            ctCenterId: center1.id, planId: proPlan.id,
            status: SubscriptionStatus.ACTIVE,
            startDate: daysAgo(15), endDate: daysFromNow(15),
            amount: proPlan.price, autoRenew: true, paymentMethod: PaymentMethod.CARD,
        },
    });

    // Categories for center 1
    const [cat1Periodic, cat1Counter, cat1Voluntary, cat1Moto] = await Promise.all([
        prisma.category.create({
            data: {
                ctCenterId: center1.id, name: 'Contrôle Technique Périodique',
                description: 'CT obligatoire (véhicules > 4 ans)', color: '#3B82F6',
                icon: 'car', duration: 30, price: 79.00, isActive: true, sortOrder: 1,
            },
        }),
        prisma.category.create({
            data: {
                ctCenterId: center1.id, name: 'Contre-Visite',
                description: 'Vérification après réparation', color: '#F59E0B',
                icon: 'refresh-cw', duration: 20, price: 19.00, isActive: true, sortOrder: 2,
            },
        }),
        prisma.category.create({
            data: {
                ctCenterId: center1.id, name: 'Contrôle Volontaire',
                description: 'Avant achat/vente', color: '#10B981',
                icon: 'clipboard-check', duration: 45, price: 99.00, isActive: true, sortOrder: 3,
            },
        }),
        prisma.category.create({
            data: {
                ctCenterId: center1.id, name: 'CT Moto/Scooter',
                description: 'Contrôle deux-roues (nouveau 2024)', color: '#8B5CF6',
                icon: 'bike', duration: 25, price: 49.00, isActive: true, sortOrder: 4,
            },
        }),
    ]);
    console.log('📁 Created 4 categories for center 1');

    // ─── Clients for center 1 (various types + edge cases) ───────────
    const clientsData = [
        { type: ClientType.NORMAL, firstName: 'Lucas', lastName: 'Bernard', email: 'lucas.bernard@email.com', phone: '+33612345681', address: '45 Rue de la Paix', city: 'Paris', postalCode: '75002' },
        { type: ClientType.PROFESSIONAL, companyName: 'Transport Express SARL', firstName: 'Sophie', lastName: 'Leroy', email: 'contact@transport-express.fr', phone: '+33612345682', address: '78 Bd Industriel', city: 'Montreuil', postalCode: '93100' },
        { type: ClientType.NORMAL, firstName: 'Emma', lastName: 'Petit', email: 'emma.petit@email.com', phone: '+33612345683', city: 'Paris', postalCode: '75015', loyaltyPoints: 120 },
        { type: ClientType.NORMAL, firstName: 'Hugo', lastName: 'Robert', email: 'hugo.robert@email.com', phone: '+33612345684', city: 'Vincennes', postalCode: '94300' },
        { type: ClientType.PROFESSIONAL, companyName: 'Taxi Parisien SAS', firstName: 'Marc', lastName: 'Thomas', email: 'marc@taxi-parisien.fr', phone: '+33612345685', address: '12 Rue du Commerce', city: 'Paris', postalCode: '75015', loyaltyPoints: 350 },
        { type: ClientType.NORMAL, firstName: 'Camille', lastName: 'Garnier', email: 'camille.garnier@email.com', phone: null, city: 'Nanterre', postalCode: '92000', notes: 'Client sans téléphone — email uniquement' },
        { type: ClientType.NORMAL, firstName: 'Deleted', lastName: 'Client', email: 'deleted@test.com', phone: '+33600000001', city: 'Paris', postalCode: '75001' },
    ];
    const clients1: any[] = [];
    for (const c of clientsData) {
        const created = await prisma.client.create({ data: { ctCenterId: center1.id, ...c } as any });
        clients1.push(created);
    }
    // Soft-delete the last client (edge case)
    await prisma.client.update({ where: { id: clients1[6].id }, data: { deletedAt: daysAgo(2) } });
    console.log('👥 Created', clients1.length, 'clients for center 1 (1 soft-deleted)');

    // ─── Vehicles (various types, fuel types, edge cases) ────────────
    const vehiclesData = [
        { clientIdx: 0, plateNumber: 'AB-123-CD', brand: 'Renault', model: 'Clio V', year: 2019, type: VehicleType.CAR, fuelType: FuelType.PETROL, color: 'Rouge', mileage: 45000 },
        { clientIdx: 0, plateNumber: 'EF-456-GH', brand: 'Peugeot', model: '308', year: 2017, type: VehicleType.CAR, fuelType: FuelType.DIESEL, color: 'Gris', mileage: 98000, lastInspectionResult: InspectionResult.PASSED, lastInspectionDate: daysAgo(180) },
        { clientIdx: 1, plateNumber: 'IJ-789-KL', brand: 'Mercedes', model: 'Sprinter', year: 2021, type: VehicleType.TRUCK, fuelType: FuelType.DIESEL, color: 'Blanc', mileage: 32000 },
        { clientIdx: 1, plateNumber: 'MN-012-OP', brand: 'Renault', model: 'Master', year: 2020, type: VehicleType.TRUCK, fuelType: FuelType.DIESEL, color: 'Bleu', mileage: 67000 },
        { clientIdx: 2, plateNumber: 'QR-345-ST', brand: 'Volkswagen', model: 'Golf 8', year: 2022, type: VehicleType.CAR, fuelType: FuelType.HYBRID, color: 'Noir', mileage: 15000 },
        { clientIdx: 3, plateNumber: 'UV-678-WX', brand: 'Tesla', model: 'Model 3', year: 2023, type: VehicleType.CAR, fuelType: FuelType.ELECTRIC, color: 'Blanc', mileage: 8000 },
        { clientIdx: 3, plateNumber: 'YZ-901-AB', brand: 'Yamaha', model: 'MT-07', year: 2021, type: VehicleType.MOTORCYCLE, fuelType: FuelType.PETROL, color: 'Bleu', mileage: 12000 },
        { clientIdx: 4, plateNumber: 'CD-234-EF', brand: 'Toyota', model: 'Camry', year: 2020, type: VehicleType.CAR, fuelType: FuelType.HYBRID, color: 'Gris', mileage: 120000, lastInspectionResult: InspectionResult.FAILED, lastInspectionDate: daysAgo(30), nextInspectionDue: daysFromNow(30) },
        { clientIdx: 4, plateNumber: 'GH-567-IJ', brand: 'Dacia', model: 'Jogger', year: 2023, type: VehicleType.CAR, fuelType: FuelType.GAS, color: 'Vert' },
        { clientIdx: 5, plateNumber: 'KL-890-MN', brand: 'Citroën', model: 'Berlingo', year: 2015, type: VehicleType.CAR, fuelType: FuelType.DIESEL, color: 'Blanc', mileage: 210000, notes: 'Véhicule très ancien — attention rouille' },
    ];
    const vehicles1: any[] = [];
    for (const v of vehiclesData) {
        const { clientIdx, ...data } = v;
        const created = await prisma.vehicle.create({
            data: { clientId: clients1[clientIdx].id, ctCenterId: center1.id, ...data } as any,
        });
        vehicles1.push(created);
    }
    console.log('🚗 Created', vehicles1.length, 'vehicles');

    // ─── Reservations — all statuses, past + present + future ────────
    const today = dateOnly(new Date());
    const yesterday = dateOnly(daysAgo(1));
    const twoDaysAgo = dateOnly(daysAgo(2));
    const tomorrow = dateOnly(daysFromNow(1));
    const nextWeek = dateOnly(daysFromNow(7));

    const reservationsData = [
        // Past completed
        { clientIdx: 0, vehicleIdx: 0, catId: cat1Periodic.id, empId: emp1.id, date: twoDaysAgo, startH: 9, status: ReservationStatus.COMPLETED, result: InspectionResult.PASSED, dur: 30 },
        { clientIdx: 1, vehicleIdx: 2, catId: cat1Periodic.id, empId: emp2.id, date: twoDaysAgo, startH: 10, status: ReservationStatus.COMPLETED, result: InspectionResult.FAILED, dur: 30 },
        // Past no-show
        { clientIdx: 2, vehicleIdx: 4, catId: cat1Periodic.id, empId: emp1.id, date: yesterday, startH: 8, status: ReservationStatus.NO_SHOW, dur: 30 },
        // Yesterday completed with counter-visite
        { clientIdx: 1, vehicleIdx: 3, catId: cat1Counter.id, empId: emp2.id, date: yesterday, startH: 14, status: ReservationStatus.COMPLETED, result: InspectionResult.CONDITIONAL, dur: 20 },
        // Today confirmed
        { clientIdx: 0, vehicleIdx: 1, catId: cat1Periodic.id, empId: emp1.id, date: today, startH: 9, status: ReservationStatus.CONFIRMED, dur: 30 },
        { clientIdx: 3, vehicleIdx: 5, catId: cat1Voluntary.id, empId: emp2.id, date: today, startH: 10, status: ReservationStatus.CONFIRMED, dur: 45 },
        // Today in progress
        { clientIdx: 4, vehicleIdx: 7, catId: cat1Periodic.id, empId: emp1.id, date: today, startH: 11, status: ReservationStatus.IN_PROGRESS, dur: 30 },
        // Today pending
        { clientIdx: 5, vehicleIdx: 9, catId: cat1Periodic.id, empId: null, date: today, startH: 14, status: ReservationStatus.PENDING, dur: 30 },
        // Today cancelled
        { clientIdx: 3, vehicleIdx: 6, catId: cat1Moto.id, empId: emp1.id, date: today, startH: 15, status: ReservationStatus.CANCELLED, dur: 25, notes: 'Client a annulé' },
        // Tomorrow
        { clientIdx: 0, vehicleIdx: 0, catId: cat1Counter.id, empId: emp2.id, date: tomorrow, startH: 9, status: ReservationStatus.CONFIRMED, dur: 20, reminderSent: true },
        { clientIdx: 2, vehicleIdx: 4, catId: cat1Periodic.id, empId: emp1.id, date: tomorrow, startH: 10, status: ReservationStatus.PENDING, dur: 30 },
        // Next week
        { clientIdx: 4, vehicleIdx: 8, catId: cat1Voluntary.id, empId: null, date: nextWeek, startH: 9, status: ReservationStatus.PENDING, dur: 45 },
        { clientIdx: 1, vehicleIdx: 2, catId: cat1Counter.id, empId: emp1.id, date: nextWeek, startH: 14, status: ReservationStatus.CONFIRMED, dur: 20 },
    ];

    const reservations1: any[] = [];
    for (const r of reservationsData) {
        const created = await prisma.reservation.create({
            data: {
                ctCenterId: center1.id,
                clientId: clients1[r.clientIdx].id,
                vehicleId: vehicles1[r.vehicleIdx].id,
                categoryId: r.catId,
                employeeId: r.empId,
                date: r.date,
                startTime: setTime(r.date, r.startH),
                endTime: setTime(r.date, r.startH, r.dur),
                status: r.status,
                result: (r as any).result || null,
                notes: (r as any).notes || null,
                reminderSent: (r as any).reminderSent || false,
                bookingCode: nextBookingCode(),
            },
        });
        reservations1.push(created);
    }
    console.log('📅 Created', reservations1.length, 'reservations (all statuses)');

    // ─── Payments ────────────────────────────────────────────────────
    const paymentsData = [
        { resIdx: 0, amount: 79, method: PaymentMethod.CARD, status: PaymentStatus.PAID, paidAt: twoDaysAgo },
        { resIdx: 1, amount: 79, method: PaymentMethod.CASH, status: PaymentStatus.PAID, paidAt: twoDaysAgo },
        { resIdx: 3, amount: 19, method: PaymentMethod.CARD, status: PaymentStatus.PAID, paidAt: yesterday },
        { resIdx: 4, amount: 79, method: PaymentMethod.ONLINE, status: PaymentStatus.PENDING },
        { resIdx: 6, amount: 79, method: PaymentMethod.CARD, status: PaymentStatus.PENDING },
        { subId: sub1.id, amount: 79.99, method: PaymentMethod.ONLINE, status: PaymentStatus.PAID, paidAt: daysAgo(15), notes: 'Abonnement Professional' },
        { resIdx: 8, amount: 49, method: PaymentMethod.CARD, status: PaymentStatus.REFUNDED, notes: 'Remboursement suite annulation' },
    ];

    const payments1: any[] = [];
    for (const p of paymentsData) {
        const created = await prisma.payment.create({
            data: {
                ctCenterId: center1.id,
                reservationId: p.resIdx !== undefined ? reservations1[p.resIdx].id : null,
                subscriptionId: (p as any).subId || null,
                amount: p.amount,
                method: p.method,
                status: p.status,
                paidAt: (p as any).paidAt || null,
                notes: (p as any).notes || null,
            },
        });
        payments1.push(created);
    }
    console.log('💰 Created', payments1.length, 'payments');

    // ─── Invoices ────────────────────────────────────────────────────
    const invoicesData = [
        { payIdx: 0, clientIdx: 0, items: [{ desc: 'CT Périodique', qty: 1, price: 79 }], subtotal: 65.83, taxAmount: 13.17, total: 79, status: InvoiceStatus.PAID, paidAt: twoDaysAgo },
        { payIdx: 1, clientIdx: 1, items: [{ desc: 'CT Périodique', qty: 1, price: 79 }], subtotal: 65.83, taxAmount: 13.17, total: 79, status: InvoiceStatus.PAID, paidAt: twoDaysAgo },
        { payIdx: 2, clientIdx: 1, items: [{ desc: 'Contre-visite', qty: 1, price: 19 }], subtotal: 15.83, taxAmount: 3.17, total: 19, status: InvoiceStatus.PAID, paidAt: yesterday },
        { payIdx: null, clientIdx: 3, items: [{ desc: 'CT Volontaire', qty: 1, price: 99 }], subtotal: 82.50, taxAmount: 16.50, total: 99, status: InvoiceStatus.DRAFT, dueDate: daysFromNow(30) },
        { payIdx: null, clientIdx: 4, items: [{ desc: 'CT Périodique', qty: 2, price: 79 }], subtotal: 131.67, taxAmount: 26.33, total: 158, status: InvoiceStatus.OVERDUE, dueDate: daysAgo(10) },
    ];
    for (const inv of invoicesData) {
        await prisma.invoice.create({
            data: {
                paymentId: inv.payIdx !== null ? payments1[inv.payIdx].id : null,
                ctCenterId: center1.id,
                clientId: clients1[inv.clientIdx].id,
                number: nextInvoiceNumber(),
                items: JSON.stringify(inv.items),
                subtotal: inv.subtotal,
                taxRate: 20,
                taxAmount: inv.taxAmount,
                total: inv.total,
                status: inv.status,
                dueDate: (inv as any).dueDate || null,
                paidAt: (inv as any).paidAt || null,
            },
        });
    }
    console.log('🧾 Created', invoicesData.length, 'invoices');

    // ─── Holidays ────────────────────────────────────────────────────
    const year = new Date().getFullYear();
    const holidaysData = [
        { name: 'Jour de l\'An', date: new Date(year, 0, 1), isRecurring: true },
        { name: 'Fête du Travail', date: new Date(year, 4, 1), isRecurring: true },
        { name: 'Fête Nationale', date: new Date(year, 6, 14), isRecurring: true },
        { name: 'Assomption', date: new Date(year, 7, 15), isRecurring: true },
        { name: 'Toussaint', date: new Date(year, 10, 1), isRecurring: true },
        { name: 'Noël', date: new Date(year, 11, 25), isRecurring: true },
        { name: 'Fermeture exceptionnelle', date: daysFromNow(14), endDate: daysFromNow(16), isRecurring: false },
    ];
    for (const h of holidaysData) {
        await prisma.holiday.create({ data: { ctCenterId: center1.id, ...h, isActive: true } });
    }
    console.log('🎄 Created', holidaysData.length, 'holidays');

    // ─── Promotions ──────────────────────────────────────────────────
    const promosData = [
        { name: '-10% Rentrée', code: 'RENTREE10', discountType: DiscountType.PERCENTAGE, discountValue: 10, startDate: daysAgo(5), endDate: daysFromNow(25), usageLimit: 50, usedCount: 12 },
        { name: 'Réduction fidélité 5€', code: 'FIDELE5', discountType: DiscountType.FIXED_AMOUNT, discountValue: 5, startDate: daysAgo(30), endDate: daysFromNow(60), usageLimit: null, usedCount: 34 },
        { name: 'Promo flash -20%', code: 'FLASH20', discountType: DiscountType.PERCENTAGE, discountValue: 20, startDate: daysAgo(60), endDate: daysAgo(30), usageLimit: 10, usedCount: 10, isActive: false },
        { name: 'Sans code (auto)', code: null, discountType: DiscountType.PERCENTAGE, discountValue: 5, startDate: daysAgo(2), endDate: daysFromNow(5), usageLimit: 100, usedCount: 0 },
    ];
    for (const p of promosData) {
        await prisma.promotion.create({ data: { ctCenterId: center1.id, ...p, isActive: p.isActive ?? true } as any });
    }
    console.log('🏷️  Created', promosData.length, 'promotions');

    // ─── Email Templates ─────────────────────────────────────────────
    const emailTplData = [
        { name: 'Confirmation', subject: 'Confirmation — {{centerName}}', body: '<h1>Bonjour {{clientName}}</h1><p>RDV confirmé le {{date}} à {{time}}.</p>', type: EmailTemplateType.CONFIRMATION, variables: ['clientName', 'date', 'time', 'centerName'] },
        { name: 'Rappel', subject: 'Rappel RDV demain — {{centerName}}', body: '<h1>Rappel</h1><p>{{clientName}}, RDV demain à {{time}}.</p>', type: EmailTemplateType.REMINDER, variables: ['clientName', 'date', 'time'] },
        { name: 'Résultat CT', subject: 'Résultat de votre CT — {{centerName}}', body: '<p>{{clientName}}, votre CT est {{result}}.</p>', type: EmailTemplateType.RESULT, variables: ['clientName', 'result', 'vehiclePlate'] },
        { name: 'Facture', subject: 'Facture {{invoiceNumber}} — {{centerName}}', body: '<p>Facture n°{{invoiceNumber}} : {{total}}€</p>', type: EmailTemplateType.INVOICE, variables: ['invoiceNumber', 'total', 'clientName'] },
        { name: 'Bienvenue', subject: 'Bienvenue chez {{centerName}}', body: '<h1>Bienvenue {{clientName}} !</h1>', type: EmailTemplateType.WELCOME, variables: ['clientName', 'centerName'] },
    ];
    for (const t of emailTplData) {
        await prisma.emailTemplate.create({
            data: { ctCenterId: center1.id, ...t, variables: JSON.stringify(t.variables), isActive: true },
        });
    }
    console.log('📧 Created', emailTplData.length, 'email templates');

    // ─── SMS Templates ───────────────────────────────────────────────
    const smsTplData = [
        { name: 'Confirmation SMS', content: 'RDV confirmé au {{centerName}} le {{date}} à {{time}}.', variables: ['centerName', 'date', 'time'] },
        { name: 'Rappel SMS', content: 'Rappel: RDV demain au {{centerName}} à {{time}}.', variables: ['centerName', 'time'] },
    ];
    for (const t of smsTplData) {
        await prisma.sMSTemplate.create({
            data: { ctCenterId: center1.id, ...t, variables: JSON.stringify(t.variables), isActive: true },
        });
    }
    console.log('📱 Created', smsTplData.length, 'SMS templates');

    // ─── SMS Usage ───────────────────────────────────────────────────
    const thisMonth = new Date(year, new Date().getMonth(), 1);
    const lastMonth = new Date(year, new Date().getMonth() - 1, 1);
    await prisma.smsUsage.create({ data: { ctCenterId: center1.id, month: lastMonth, sentCount: 87, quota: 100 } });
    await prisma.smsUsage.create({ data: { ctCenterId: center1.id, month: thisMonth, sentCount: 23, quota: 100 } });
    console.log('📊 Created 2 SMS usage records');

    // ─── Notifications ───────────────────────────────────────────────
    const notifData = [
        { userId: admin1.id, title: 'Nouveau client', message: 'Lucas Bernard s\'est inscrit.', type: NotificationType.SYSTEM, isRead: true },
        { userId: admin1.id, title: 'Paiement reçu', message: '79€ — CT Périodique', type: NotificationType.PAYMENT, isRead: false },
        { userId: emp1.id, title: 'Réservation assignée', message: 'Nouveau RDV aujourd\'hui à 11h', type: NotificationType.RESERVATION, isRead: false },
        { userId: emp2.id, title: 'Rappel', message: '3 RDV demain', type: NotificationType.REMINDER, isRead: false },
        { userId: admin1.id, title: 'Abonnement', message: 'Votre abonnement Professional expire dans 15 jours.', type: NotificationType.SYSTEM, isRead: false },
    ];
    for (const n of notifData) {
        await prisma.notification.create({ data: n });
    }
    console.log('🔔 Created', notifData.length, 'notifications');

    // ─── Chat Messages ───────────────────────────────────────────────
    const chatData = [
        { senderId: admin1.id, receiverId: emp1.id, content: 'Pierre, tu peux prendre le RDV de 14h ?', isRead: true },
        { senderId: emp1.id, receiverId: admin1.id, content: 'Oui, pas de souci patron.', isRead: true },
        { senderId: admin1.id, receiverId: emp2.id, content: 'Marie, le client Bernard arrive à 9h demain.', isRead: false },
    ];
    for (const m of chatData) {
        await prisma.chatMessage.create({ data: { ctCenterId: center1.id, ...m } });
    }
    console.log('💬 Created', chatData.length, 'chat messages');

    // ─── Settings (center-level) ─────────────────────────────────────
    const settingsData = [
        { key: 'payment_methods', value: ['CASH', 'CARD', 'ONLINE'] },
        { key: 'slot_duration', value: 30 },
        { key: 'max_daily_reservations', value: 20 },
        { key: 'auto_confirm', value: false },
        { key: 'reminder_hours_before', value: 24 },
        { key: 'trash_retention_days', value: 30 },
    ];
    for (const s of settingsData) {
        await prisma.setting.create({ data: { ctCenterId: center1.id, key: s.key, value: s.value as any } });
    }
    console.log('⚙️  Created', settingsData.length, 'center settings');

    // ─── Audit Logs ──────────────────────────────────────────────────
    const auditData = [
        { userId: admin1.id, action: 'CREATE', entity: 'Client', entityId: clients1[0].id, newData: { name: 'Lucas Bernard' }, ipAddress: '192.168.1.10' },
        { userId: admin1.id, action: 'UPDATE', entity: 'Reservation', entityId: reservations1[0].id, oldData: { status: 'PENDING' }, newData: { status: 'CONFIRMED' }, ipAddress: '192.168.1.10' },
        { userId: emp1.id, action: 'UPDATE', entity: 'Reservation', entityId: reservations1[0].id, oldData: { status: 'CONFIRMED' }, newData: { status: 'COMPLETED' }, ipAddress: '192.168.1.20' },
        { userId: superAdmin.id, action: 'LOGIN', entity: 'User', entityId: superAdmin.id, ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0' },
    ];
    for (const a of auditData) {
        await prisma.auditLog.create({ data: { ctCenterId: center1.id, ...a } as any });
    }
    console.log('📝 Created', auditData.length, 'audit logs');

    // ─── Documents ───────────────────────────────────────────────────
    await prisma.document.create({
        data: {
            ctCenterId: center1.id, name: 'Rapport CT - AB-123-CD.pdf',
            type: 'report', filePath: '/uploads/reports/rapport-ab123cd.pdf',
            size: 245000, mimeType: 'application/pdf', uploadedById: emp1.id,
        },
    });
    await prisma.document.create({
        data: {
            ctCenterId: center1.id, name: 'Logo Auto Plus.png',
            type: 'logo', filePath: '/uploads/logos/auto-plus.png',
            size: 35000, mimeType: 'image/png', uploadedById: admin1.id,
        },
    });
    console.log('📄 Created 2 documents');

    // ─── Landing Page ────────────────────────────────────────────────
    await prisma.landingPage.create({
        data: {
            ctCenterId: center1.id, templateId: 1,
            config: JSON.stringify({
                heroTitle: 'Votre contrôle technique en toute confiance',
                heroSubtitle: 'Prenez rendez-vous en quelques clics',
                primaryColor: '#3B82F6', showTestimonials: true, showMap: true,
            }),
            isPublished: true,
            seoTitle: 'Contrôle Technique Auto Plus — Paris 11',
            seoDescription: 'Centre de CT agréé Dekra à Paris. RDV en ligne.',
        },
    });
    console.log('🌐 Created landing page');

    // ═══════════════════════════════════════════════════════════════════
    // CENTER 2: "CT Lyon Express" — smaller center, Starter plan
    // ═══════════════════════════════════════════════════════════════════
    const admin2 = await prisma.user.create({
        data: {
            email: 'paul.durand@lyon-ct.fr', password: await hash('CTAdmin123!'),
            firstName: 'Paul', lastName: 'Durand', phone: '+33698765432',
            role: UserRole.CT_ADMIN, isActive: true, emailVerified: true,
        },
    });
    const center2 = await prisma.cTCenter.create({
        data: {
            name: 'CT Lyon Express', slug: 'lyon-express',
            address: '42 Rue de la Part-Dieu', city: 'Lyon', postalCode: '69003',
            phone: '+33472345678', email: 'contact@lyon-ct.fr',
            approvalNumber: 'CT-69003-001', brand: 'Autosur',
            description: 'Centre rapide au cœur de Lyon.',
            latitude: 45.7640, longitude: 4.8357,
            timezone: 'Europe/Paris', currency: 'EUR',
            openingHours: JSON.stringify({
                monday: { open: '07:30', close: '19:00', closed: false },
                tuesday: { open: '07:30', close: '19:00', closed: false },
                wednesday: { open: '07:30', close: '19:00', closed: false },
                thursday: { open: '07:30', close: '19:00', closed: false },
                friday: { open: '07:30', close: '19:00', closed: false },
                saturday: { open: '08:00', close: '12:00', closed: false },
                sunday: { open: '00:00', close: '00:00', closed: true },
            }),
            isActive: true, ownerId: admin2.id,
        },
    });
    await prisma.user.update({ where: { id: admin2.id }, data: { ctCenterId: center2.id } });
    console.log('🏢 Center 2:', center2.name);

    // Starter subscription (expired — edge case)
    await prisma.subscription.create({
        data: {
            ctCenterId: center2.id, planId: starterPlan.id,
            status: SubscriptionStatus.EXPIRED,
            startDate: daysAgo(60), endDate: daysAgo(30),
            amount: starterPlan.price,
        },
    });
    // Then renewed
    await prisma.subscription.create({
        data: {
            ctCenterId: center2.id, planId: starterPlan.id,
            status: SubscriptionStatus.ACTIVE,
            startDate: daysAgo(10), endDate: daysFromNow(20),
            amount: starterPlan.price, autoRenew: true, paymentMethod: PaymentMethod.ONLINE,
        },
    });

    // 1 employee
    const emp2c2 = await prisma.user.create({
        data: {
            email: 'sarah.blanc@lyon-ct.fr', password: await hash('Employee123!'),
            firstName: 'Sarah', lastName: 'Blanc', phone: '+33698765433',
            role: UserRole.EMPLOYEE, ctCenterId: center2.id, isActive: true, emailVerified: true,
        },
    });

    // 1 category
    const cat2 = await prisma.category.create({
        data: {
            ctCenterId: center2.id, name: 'CT Standard',
            description: 'Contrôle technique standard', color: '#EF4444',
            duration: 35, price: 75.00, isActive: true, sortOrder: 1,
        },
    });

    // 2 clients + 2 vehicles + 2 reservations
    const clientLyon1 = await prisma.client.create({
        data: { ctCenterId: center2.id, type: ClientType.NORMAL, firstName: 'Alain', lastName: 'Mercier', email: 'alain.mercier@email.com', phone: '+33698765434', city: 'Lyon' },
    });
    const clientLyon2 = await prisma.client.create({
        data: { ctCenterId: center2.id, type: ClientType.PROFESSIONAL, companyName: 'Livraison Rhône', firstName: 'Claire', lastName: 'Faure', email: 'claire@livraison-rhone.fr', phone: '+33698765435', city: 'Villeurbanne' },
    });

    const vLyon1 = await prisma.vehicle.create({
        data: { clientId: clientLyon1.id, ctCenterId: center2.id, plateNumber: 'AA-111-BB', brand: 'Fiat', model: '500', year: 2018, type: VehicleType.CAR, color: 'Rouge' },
    });
    const vLyon2 = await prisma.vehicle.create({
        data: { clientId: clientLyon2.id, ctCenterId: center2.id, plateNumber: 'CC-222-DD', brand: 'Iveco', model: 'Daily', year: 2019, type: VehicleType.TRUCK, color: 'Blanc' },
    });

    await prisma.reservation.create({
        data: {
            ctCenterId: center2.id, clientId: clientLyon1.id, vehicleId: vLyon1.id,
            categoryId: cat2.id, employeeId: emp2c2.id,
            date: today, startTime: setTime(today, 9), endTime: setTime(today, 9, 35),
            status: ReservationStatus.CONFIRMED, bookingCode: nextBookingCode(),
        },
    });
    await prisma.reservation.create({
        data: {
            ctCenterId: center2.id, clientId: clientLyon2.id, vehicleId: vLyon2.id,
            categoryId: cat2.id, date: tomorrow,
            startTime: setTime(tomorrow, 14), endTime: setTime(tomorrow, 14, 35),
            status: ReservationStatus.PENDING, bookingCode: nextBookingCode(),
        },
    });
    console.log('✅ Seeded center 2 (Lyon) with clients, vehicles, reservations');

    // ═══════════════════════════════════════════════════════════════════
    // CENTER 3: Inactive center (edge case)
    // ═══════════════════════════════════════════════════════════════════
    const admin3 = await prisma.user.create({
        data: {
            email: 'marc.henry@ct-marseille.fr', password: await hash('CTAdmin123!'),
            firstName: 'Marc', lastName: 'Henry', phone: '+33491000000',
            role: UserRole.CT_ADMIN, isActive: false, emailVerified: false,
        },
    });
    const center3 = await prisma.cTCenter.create({
        data: {
            name: 'CT Marseille (fermé)', slug: 'marseille-ferme',
            address: '5 Quai du Port', city: 'Marseille', postalCode: '13002',
            phone: '+33491000001', email: 'contact@ct-marseille.fr',
            isActive: false, ownerId: admin3.id, deletedAt: daysAgo(30),
        },
    });
    await prisma.subscription.create({
        data: {
            ctCenterId: center3.id, planId: starterPlan.id,
            status: SubscriptionStatus.CANCELLED,
            startDate: daysAgo(120), endDate: daysAgo(90),
            amount: starterPlan.price,
        },
    });
    console.log('🏢 Center 3 (inactive):', center3.name);

    // ═══════════════════════════════════════════════════════════════════
    console.log('\n✅ Development seed completed!');
    console.log('\n📝 Credentials:');
    console.log('   Super Admin:  admin@agendact.com / SuperAdmin123!');
    console.log('   CT Admin 1:   jean.dupont@auto-plus.fr / CTAdmin123!');
    console.log('   CT Admin 2:   paul.durand@lyon-ct.fr / CTAdmin123!');
    console.log('   Employee:     pierre.martin@auto-plus.fr / Employee123!');
    console.log('   Employee:     marie.dubois@auto-plus.fr / Employee123!');
    console.log('   Employee:     sarah.blanc@lyon-ct.fr / Employee123!');
}

main()
    .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
