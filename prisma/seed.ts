import { PrismaClient, UserRole, SubscriptionStatus, ClientType, VehicleType, ReservationStatus, PaymentStatus, PaymentMethod, InvoiceStatus, EmailTemplateType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Clear existing data (in development only)
    if (process.env.NODE_ENV !== 'production') {
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
        await prisma.user.deleteMany();
        await prisma.cTCenter.deleteMany();
        console.log('🗑️  Cleared existing data');
    }

    // Hash password function
    const hashPassword = async (password: string) => {
        return bcrypt.hash(password, 10);
    };

    // Create Super Admin
    const superAdminPassword = await hashPassword('SuperAdmin123!');
    const superAdmin = await prisma.user.create({
        data: {
            email: 'admin@agendact.com',
            password: superAdminPassword,
            firstName: 'Super',
            lastName: 'Admin',
            phone: '+33600000000',
            role: UserRole.SUPER_ADMIN,
            isActive: true,
            emailVerified: true,
        },
    });
    console.log('👤 Created Super Admin:', superAdmin.email);

    // Create Subscription Plans
    const plans = await Promise.all([
        prisma.subscriptionPlan.create({
            data: {
                name: 'Starter',
                description: 'Plan idéal pour les petits centres',
                price: 29.99,
                duration: 30,
                features: JSON.stringify([
                    'Jusqu\'à 3 utilisateurs',
                    'Gestion des réservations',
                    'Gestion des clients',
                    'Support email',
                ]),
                maxUsers: 3,
                isActive: true,
                sortOrder: 1,
            },
        }),
        prisma.subscriptionPlan.create({
            data: {
                name: 'Professional',
                description: 'Pour les centres de taille moyenne',
                price: 79.99,
                duration: 30,
                features: JSON.stringify([
                    'Jusqu\'à 10 utilisateurs',
                    'Toutes les fonctionnalités Starter',
                    'Statistiques avancées',
                    'SMS et Email automatiques',
                    'Support prioritaire',
                ]),
                maxUsers: 10,
                isActive: true,
                sortOrder: 2,
            },
        }),
        prisma.subscriptionPlan.create({
            data: {
                name: 'Enterprise',
                description: 'Solution complète pour les grands centres',
                price: 149.99,
                duration: 30,
                features: JSON.stringify([
                    'Utilisateurs illimités',
                    'Toutes les fonctionnalités Professional',
                    'API access',
                    'Page de réservation personnalisée',
                    'Manager dédié',
                    'Formation incluse',
                ]),
                maxUsers: 100,
                isActive: true,
                sortOrder: 3,
            },
        }),
    ]);
    console.log('📦 Created', plans.length, 'subscription plans');

    // Create a demo CT Center Admin
    const ctAdminPassword = await hashPassword('CTAdmin123!');
    const ctAdmin = await prisma.user.create({
        data: {
            email: 'demo@controle-technique.fr',
            password: ctAdminPassword,
            firstName: 'Jean',
            lastName: 'Dupont',
            phone: '+33612345678',
            role: UserRole.CT_ADMIN,
            isActive: true,
            emailVerified: true,
        },
    });
    console.log('👤 Created CT Admin:', ctAdmin.email);

    // Create demo CT Center
    const ctCenter = await prisma.cTCenter.create({
        data: {
            name: 'Contrôle Technique Auto Plus',
            slug: 'auto-plus',
            address: '123 Avenue de la République',
            city: 'Paris',
            postalCode: '75011',
            phone: '+33145678900',
            email: 'contact@auto-plus-ct.fr',
            siren: '123456789',
            siret: '12345678900012',
            approvalNumber: 'CT-75011-001',
            brand: 'Dekra',
            description: 'Centre de contrôle technique agréé depuis 2010',
            timezone: 'Europe/Paris',
            currency: 'EUR',
            openingHours: JSON.stringify({
                monday: { open: '08:00', close: '18:00', closed: false },
                tuesday: { open: '08:00', close: '18:00', closed: false },
                wednesday: { open: '08:00', close: '18:00', closed: false },
                thursday: { open: '08:00', close: '18:00', closed: false },
                friday: { open: '08:00', close: '18:00', closed: false },
                saturday: { open: '09:00', close: '13:00', closed: false },
                sunday: { open: '00:00', close: '00:00', closed: true },
            }),
            isActive: true,
            ownerId: ctAdmin.id,
        },
    });

    // Update CT Admin with center
    await prisma.user.update({
        where: { id: ctAdmin.id },
        data: { ctCenterId: ctCenter.id },
    });
    console.log('🏢 Created CT Center:', ctCenter.name);

    // Create subscription for CT Center
    const subscription = await prisma.subscription.create({
        data: {
            ctCenterId: ctCenter.id,
            planId: plans[1].id, // Professional plan
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: plans[1].price,
            autoRenew: true,
        },
    });
    console.log('📋 Created subscription:', subscription.id);

    // Create employees
    const employeePassword = await hashPassword('Employee123!');
    const employees = await Promise.all([
        prisma.user.create({
            data: {
                email: 'pierre.martin@auto-plus-ct.fr',
                password: employeePassword,
                firstName: 'Pierre',
                lastName: 'Martin',
                phone: '+33612345679',
                role: UserRole.EMPLOYEE,
                ctCenterId: ctCenter.id,
                isActive: true,
                emailVerified: true,
            },
        }),
        prisma.user.create({
            data: {
                email: 'marie.dubois@auto-plus-ct.fr',
                password: employeePassword,
                firstName: 'Marie',
                lastName: 'Dubois',
                phone: '+33612345680',
                role: UserRole.EMPLOYEE,
                ctCenterId: ctCenter.id,
                isActive: true,
                emailVerified: true,
            },
        }),
    ]);
    console.log('👥 Created', employees.length, 'employees');

    // Create categories
    const categories = await Promise.all([
        prisma.category.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Contrôle Technique Périodique',
                description: 'Contrôle technique obligatoire pour véhicules de plus de 4 ans',
                color: '#3B82F6',
                icon: 'car',
                duration: 30,
                price: 79.00,
                isActive: true,
                sortOrder: 1,
            },
        }),
        prisma.category.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Contre-Visite',
                description: 'Contrôle après réparation des défauts',
                color: '#F59E0B',
                icon: 'refresh-cw',
                duration: 20,
                price: 19.00,
                isActive: true,
                sortOrder: 2,
            },
        }),
        prisma.category.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Contrôle Volontaire',
                description: 'Contrôle avant achat ou vente de véhicule',
                color: '#10B981',
                icon: 'clipboard-check',
                duration: 45,
                price: 99.00,
                isActive: true,
                sortOrder: 3,
            },
        }),
    ]);
    console.log('📁 Created', categories.length, 'categories');

    // Create clients
    const clients = await Promise.all([
        prisma.client.create({
            data: {
                ctCenterId: ctCenter.id,
                type: ClientType.NORMAL,
                firstName: 'Lucas',
                lastName: 'Bernard',
                email: 'lucas.bernard@email.com',
                phone: '+33612345681',
                address: '45 Rue de la Paix',
                city: 'Paris',
                postalCode: '75002',
            },
        }),
        prisma.client.create({
            data: {
                ctCenterId: ctCenter.id,
                type: ClientType.PROFESSIONAL,
                companyName: 'Transport Express SARL',
                firstName: 'Sophie',
                lastName: 'Leroy',
                email: 'contact@transport-express.fr',
                phone: '+33612345682',
                address: '78 Boulevard Industriel',
                city: 'Montreuil',
                postalCode: '93100',
            },
        }),
        prisma.client.create({
            data: {
                ctCenterId: ctCenter.id,
                type: ClientType.NORMAL,
                firstName: 'Emma',
                lastName: 'Petit',
                email: 'emma.petit@email.com',
                phone: '+33612345683',
                city: 'Paris',
                postalCode: '75015',
            },
        }),
    ]);
    console.log('👥 Created', clients.length, 'clients');

    // Create vehicles
    const vehicles = await Promise.all([
        prisma.vehicle.create({
            data: {
                clientId: clients[0].id,
                ctCenterId: ctCenter.id,
                plateNumber: 'AB-123-CD',
                brand: 'Renault',
                model: 'Clio',
                year: 2019,
                type: VehicleType.CAR,
                color: 'Rouge',
            },
        }),
        prisma.vehicle.create({
            data: {
                clientId: clients[1].id,
                ctCenterId: ctCenter.id,
                plateNumber: 'EF-456-GH',
                brand: 'Mercedes',
                model: 'Sprinter',
                year: 2021,
                type: VehicleType.TRUCK,
                color: 'Blanc',
            },
        }),
        prisma.vehicle.create({
            data: {
                clientId: clients[1].id,
                ctCenterId: ctCenter.id,
                plateNumber: 'IJ-789-KL',
                brand: 'Peugeot',
                model: 'Boxer',
                year: 2020,
                type: VehicleType.TRUCK,
                color: 'Gris',
            },
        }),
        prisma.vehicle.create({
            data: {
                clientId: clients[2].id,
                ctCenterId: ctCenter.id,
                plateNumber: 'MN-012-OP',
                brand: 'Volkswagen',
                model: 'Golf',
                year: 2018,
                type: VehicleType.CAR,
                color: 'Noir',
            },
        }),
    ]);
    console.log('🚗 Created', vehicles.length, 'vehicles');

    // Create sample reservations
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reservations = await Promise.all([
        prisma.reservation.create({
            data: {
                ctCenterId: ctCenter.id,
                clientId: clients[0].id,
                vehicleId: vehicles[0].id,
                categoryId: categories[0].id,
                employeeId: employees[0].id,
                date: today,
                startTime: new Date(today.setHours(9, 0, 0, 0)),
                endTime: new Date(today.setHours(9, 30, 0, 0)),
                status: ReservationStatus.CONFIRMED,
                bookingCode: 'RES-' + Date.now().toString().slice(-6),
            },
        }),
        prisma.reservation.create({
            data: {
                ctCenterId: ctCenter.id,
                clientId: clients[1].id,
                vehicleId: vehicles[1].id,
                categoryId: categories[0].id,
                employeeId: employees[1].id,
                date: today,
                startTime: new Date(today.setHours(10, 0, 0, 0)),
                endTime: new Date(today.setHours(10, 30, 0, 0)),
                status: ReservationStatus.CONFIRMED,
                bookingCode: 'RES-' + (Date.now() + 1).toString().slice(-6),
            },
        }),
        prisma.reservation.create({
            data: {
                ctCenterId: ctCenter.id,
                clientId: clients[2].id,
                vehicleId: vehicles[3].id,
                categoryId: categories[0].id,
                date: tomorrow,
                startTime: new Date(tomorrow.setHours(14, 0, 0, 0)),
                endTime: new Date(tomorrow.setHours(14, 30, 0, 0)),
                status: ReservationStatus.PENDING,
                bookingCode: 'RES-' + (Date.now() + 2).toString().slice(-6),
            },
        }),
    ]);
    console.log('📅 Created', reservations.length, 'reservations');

    // Create email templates
    const emailTemplates = await Promise.all([
        prisma.emailTemplate.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Confirmation de réservation',
                subject: 'Confirmation de votre rendez-vous - {{centerName}}',
                body: `
          <h1>Bonjour {{clientName}},</h1>
          <p>Votre rendez-vous a été confirmé.</p>
          <p><strong>Date:</strong> {{date}}</p>
          <p><strong>Heure:</strong> {{time}}</p>
          <p><strong>Véhicule:</strong> {{vehiclePlate}}</p>
          <p>Adresse: {{centerAddress}}</p>
          <p>Merci de votre confiance,<br>L'équipe {{centerName}}</p>
        `,
                type: EmailTemplateType.CONFIRMATION,
                variables: JSON.stringify(['clientName', 'date', 'time', 'vehiclePlate', 'centerName', 'centerAddress']),
                isActive: true,
            },
        }),
        prisma.emailTemplate.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Rappel de rendez-vous',
                subject: 'Rappel: Votre rendez-vous demain - {{centerName}}',
                body: `
          <h1>Rappel</h1>
          <p>Bonjour {{clientName}},</p>
          <p>Nous vous rappelons votre rendez-vous prévu demain:</p>
          <p><strong>Date:</strong> {{date}}</p>
          <p><strong>Heure:</strong> {{time}}</p>
          <p>À demain!</p>
        `,
                type: EmailTemplateType.REMINDER,
                variables: JSON.stringify(['clientName', 'date', 'time', 'centerName']),
                isActive: true,
            },
        }),
    ]);
    console.log('📧 Created', emailTemplates.length, 'email templates');

    // Create holidays
    const holidays = await Promise.all([
        prisma.holiday.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Jour de l\'An',
                date: new Date(new Date().getFullYear(), 0, 1),
                isRecurring: true,
                isActive: true,
            },
        }),
        prisma.holiday.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Fête du Travail',
                date: new Date(new Date().getFullYear(), 4, 1),
                isRecurring: true,
                isActive: true,
            },
        }),
        prisma.holiday.create({
            data: {
                ctCenterId: ctCenter.id,
                name: 'Noël',
                date: new Date(new Date().getFullYear(), 11, 25),
                isRecurring: true,
                isActive: true,
            },
        }),
    ]);
    console.log('🎄 Created', holidays.length, 'holidays');

    // Create landing page
    const landingPage = await prisma.landingPage.create({
        data: {
            ctCenterId: ctCenter.id,
            templateId: 1,
            config: JSON.stringify({
                heroTitle: 'Votre contrôle technique en toute confiance',
                heroSubtitle: 'Prenez rendez-vous en ligne en quelques clics',
                primaryColor: '#3B82F6',
            }),
            isPublished: true,
            seoTitle: 'Contrôle Technique Auto Plus - Paris',
            seoDescription: 'Centre de contrôle technique agréé à Paris. Prenez rendez-vous en ligne.',
        },
    });
    console.log('🌐 Created landing page');

    console.log('✅ Seed completed successfully!');
    console.log('\n📝 Demo Credentials:');
    console.log('   Super Admin: admin@agendact.com / SuperAdmin123!');
    console.log('   CT Admin: demo@controle-technique.fr / CTAdmin123!');
    console.log('   Employee: pierre.martin@auto-plus-ct.fr / Employee123!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
