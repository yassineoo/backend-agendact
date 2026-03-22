import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('--- Starting SSL Automation Test ---');

    // 1. Get the super admin or a specific user to own the center
    const owner = await prisma.user.findFirst({
        where: { email: 'admin@agendact.com' }
    });

    if (!owner) {
        console.error('Super admin not found. Seed the DB first.');
        return;
    }

    const testSlug = 'testcenter' + Math.floor(Math.random() * 1000);
    console.log(`1. Generating test center with slug: ${testSlug}`);

    // 2. Create the Center
    const center = await prisma.cTCenter.create({
        data: {
            name: 'Test Center SSL',
            slug: testSlug,
            address: '123 Test Street',
            city: 'Testville',
            postalCode: '12345',
            phone: '1234567890',
            email: 'test@agendact.com',
            ownerId: owner.id,
        }
    });

    console.log(`2. Center created: ${center.id}`);

    // 3. Create and publish the Landing Page for this center (this simulates the backend trigger)
    console.log(`3. Publishing landing page to trigger SSL Webhook...`);
    
    try {
        const response = await fetch('http://host.docker.internal:9000/hooks/generate-ssl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain: testSlug })
        });
        
        console.log('Webhook Response Status:', response.status);
        console.log(`\n✅ Test complete. The SSL certificate for ${testSlug}.agendact.com should be generated.`);
        console.log(`To verify, check the webhook logs: sudo journalctl -u webhook -f`);
    } catch (error: any) {
        console.error('Webhook call failed:', error.message);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });