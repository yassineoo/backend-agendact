import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting PRODUCTION seed...');

    const hash = (pw: string) => bcrypt.hash(pw, 10);

    // 1. Super Admin (idempotent)
    const existing = await prisma.user.findUnique({ where: { email: 'admin@agendact.com' } });
    if (!existing) {
        await prisma.user.create({
            data: {
                email: 'admin@agendact.com',
                password: await hash('SuperAdmin123!'),
                firstName: 'Super',
                lastName: 'Admin',
                phone: '+33600000000',
                role: UserRole.SUPER_ADMIN,
                isActive: true,
                emailVerified: true,
            },
        });
        console.log('👤 Created Super Admin');
    } else {
        console.log('👤 Super Admin already exists');
    }

    // 2. Subscription Plans (idempotent)
    const planData = [
        {
            name: 'Starter',
            description: 'Plan idéal pour les petits centres',
            price: 29.99,
            duration: 30,
            features: JSON.stringify(['Jusqu\'à 3 utilisateurs', 'Gestion des réservations', 'Gestion des clients', 'Support email']),
            maxUsers: 3,
            sortOrder: 1,
        },
        {
            name: 'Professional',
            description: 'Pour les centres de taille moyenne',
            price: 79.99,
            duration: 30,
            features: JSON.stringify(['Jusqu\'à 10 utilisateurs', 'Toutes les fonctionnalités Starter', 'Statistiques avancées', 'SMS et Email automatiques', 'Support prioritaire']),
            maxUsers: 10,
            sortOrder: 2,
        },
        {
            name: 'Enterprise',
            description: 'Solution complète pour les grands centres',
            price: 149.99,
            duration: 30,
            features: JSON.stringify(['Utilisateurs illimités', 'Toutes les fonctionnalités Professional', 'API access', 'Page personnalisée', 'Manager dédié', 'Formation incluse']),
            maxUsers: 100,
            sortOrder: 3,
        },
    ];

    for (const plan of planData) {
        const exists = await prisma.subscriptionPlan.findFirst({ where: { name: plan.name } });
        if (!exists) {
            await prisma.subscriptionPlan.create({ data: { ...plan, isActive: true } });
            console.log(`📦 Created plan: ${plan.name}`);
        } else {
            console.log(`📦 Plan "${plan.name}" already exists`);
        }
    }

    // 3. System Settings (idempotent)
    const settings = [
        { key: 'platform_name', value: 'AgendaCT', label: 'Nom de la plateforme' },
        { key: 'platform_url', value: 'https://agendact.com', label: 'URL de la plateforme' },
        { key: 'support_email', value: 'support@agendact.com', label: 'Email support' },
        { key: 'email_provider', value: 'sweego', label: 'Fournisseur email' },
        { key: 'email_from', value: 'no-reply@agendact.com', label: 'Email expéditeur' },
        { key: 'email_from_name', value: 'AgendaCT', label: 'Nom expéditeur' },
        { key: 'maintenance_mode', value: false, label: 'Mode maintenance' },
        { key: 'default_trial_days', value: 14, label: 'Jours d\'essai par défaut' },
    ];

    for (const s of settings) {
        await prisma.systemSetting.upsert({
            where: { key: s.key },
            update: {},
            create: { key: s.key, value: s.value as any, label: s.label },
        });
    }
    console.log('⚙️  Upserted', settings.length, 'system settings');

    console.log('\n✅ Production seed completed!');
    console.log('📝 Super Admin: admin@agendact.com / SuperAdmin123!');
}

main()
    .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
