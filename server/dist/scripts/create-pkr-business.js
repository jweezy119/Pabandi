"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@pabandi.com' }
    });
    if (!user) {
        console.log("admin@pabandi.com not found!");
        return;
    }
    const business = await prisma.business.upsert({
        where: { ownerId: user.id },
        update: {
            currency: 'PKR',
            country: 'Pakistan',
            city: 'Karachi'
        },
        create: {
            ownerId: user.id,
            name: 'PKR Safepay Escrow Store',
            category: 'ECOMMERCE',
            address: '123 Tech Road',
            city: 'Karachi',
            country: 'Pakistan',
            phone: '+923001234567',
            email: 'pkr.store@pabandi.com',
            currency: 'PKR',
            isVerified: true,
            isActive: true,
        }
    });
    console.log("Created/Updated PKR Business:");
    console.log(`Business ID: ${business.id}`);
    console.log(`Name: ${business.name}`);
    console.log(`Currency: ${business.currency}`);
    const service = await prisma.businessService.upsert({
        where: { id: 'test-pkr-service-id' },
        update: {
            businessId: business.id,
            price: 500,
            name: 'Test PKR Product',
            duration: 30,
        },
        create: {
            id: 'test-pkr-service-id',
            businessId: business.id,
            name: 'Test PKR Product',
            description: 'A test product for Safepay escrow testing',
            duration: 30,
            price: 500,
        }
    });
    console.log(`Created Service ID: ${service.id} (Price: 500 PKR)`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=create-pkr-business.js.map