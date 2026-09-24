"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Real, properly-named demo businesses so the public directory/search is actually useful.
// Categories match the app's enum. Names are generic-but-real so search returns meaningful hits.
const SEED = [
    // RESTAURANT
    { name: 'Lahore Grill House', category: 'RESTAURANT', city: 'Lahore', address: 'MM Alam Road, Lahore', description: 'Family BBQ & grill restaurant with dine-in and catering.' },
    { name: 'Karachi Sea Food', category: 'RESTAURANT', city: 'Karachi', address: 'Clifton, Karachi', description: 'Fresh coastal seafood and biryani.' },
    { name: 'Chicago Deep Dish Co', category: 'RESTAURANT', city: 'Chicago', address: 'West Loop, Chicago', description: 'Authentic deep-dish pizza and pasta.' },
    { name: 'Brew & Bean Cafe', category: 'RESTAURANT', city: 'Islamabad', address: 'F-7, Islamabad', description: 'Specialty coffee, brunch and pastries.' },
    { name: 'The Curry Pot', category: 'RESTAURANT', city: 'London', address: 'Wembley, London', description: 'Desi curries, naan and thali.' },
    // SALON
    { name: 'Glow Beauty Salon', category: 'SALON', city: 'Lahore', address: 'Gulberg, Lahore', description: 'Hair, makeup and bridal styling.' },
    { name: 'Locks & Looks', category: 'SALON', city: 'Karachi', address: 'DHA, Karachi', description: 'Unisex hair salon and barber.' },
    { name: 'Manhattan Nail Studio', category: 'SALON', city: 'New York', address: 'SoHo, New York', description: 'Nails, manicure and pedicure.' },
    // SPA
    { name: 'Serene Spa & Wellness', category: 'SPA', city: 'Islamabad', address: 'Blue Area, Islamabad', description: 'Massage, facials and relaxation therapy.' },
    { name: 'Oasis Day Spa', category: 'SPA', city: 'Dubai', address: 'JLT, Dubai', description: 'Full-body massage and hammam.' },
    // CLINIC
    { name: 'CityCare Dental Clinic', category: 'CLINIC', city: 'Lahore', address: 'Johar Town, Lahore', description: 'Dentistry, whitening and orthodontics.' },
    { name: 'MediPlus Family Clinic', category: 'CLINIC', city: 'Karachi', address: 'North Nazimabad, Karachi', description: 'General physician and vaccinations.' },
    { name: 'Lakeview Physio', category: 'CLINIC', city: 'Chicago', address: 'Lincoln Park, Chicago', description: 'Physical therapy and rehab.' },
    // FITNESS_CENTER
    { name: 'Iron Forge Gym', category: 'FITNESS_CENTER', city: 'Lahore', address: 'Model Town, Lahore', description: 'Strength training and group classes.' },
    { name: 'Pulse Fitness Studio', category: 'FITNESS_CENTER', city: 'New York', address: 'Brooklyn, New York', description: 'HIIT, yoga and personal training.' },
    // FREELANCE
    { name: 'Ahsan Khan — UI/UX Designer', category: 'FREELANCE', city: 'Remote', address: 'Remote', description: 'Product design, Figma and design systems.' },
    { name: 'Sara Dev — Full Stack Engineer', category: 'FREELANCE', city: 'Remote', address: 'Remote', description: 'React, Node and AI integration.' },
    { name: 'Bilal Studio — Video Editor', category: 'FREELANCE', city: 'Karachi', address: 'Karachi', description: 'Short-form video, reels and motion graphics.' },
    { name: 'Nadia Writes — Content & Copy', category: 'FREELANCE', city: 'Remote', address: 'Remote', description: 'SEO blogs, ad copy and scripts.' },
    // LIVE_SELLER
    { name: 'TrendMart Live', category: 'LIVE_SELLER', city: 'Lahore', address: 'Lahore', description: 'Live shopping for fashion and gadgets.' },
    { name: 'GadgetGuru Live', category: 'LIVE_SELLER', city: 'Karachi', address: 'Karachi', description: 'Live unboxings and electronics deals.' },
    // MARKETPLACE
    { name: 'BazaarHub Marketplace', category: 'MARKETPLACE', city: 'Islamabad', address: 'Islamabad', description: 'Local goods, crafts and services.' },
    { name: 'CraftCorner', category: 'MARKETPLACE', city: 'New York', address: 'New York', description: 'Handmade and artisan marketplace.' },
    // PROPERTY_RENTAL
    { name: 'Skyline Stays', category: 'PROPERTY_RENTAL', city: 'Dubai', address: 'Marina, Dubai', description: 'Short-term luxury rentals.' },
    { name: 'CozyNest Rentals', category: 'PROPERTY_RENTAL', city: 'Chicago', address: 'Chicago', description: 'Airbnb-style short stays.' },
];
async function main() {
    let created = 0;
    for (const b of SEED) {
        const existing = await prisma.business.findFirst({ where: { name: b.name } });
        if (existing)
            continue;
        await prisma.business.create({
            data: {
                name: b.name,
                category: b.category,
                city: b.city,
                address: b.address,
                description: b.description,
                isActive: true,
                isVerified: true,
                isClaimed: false,
                rating: 4.5,
                reviewCount: 1,
                email: 'contact@pabandi.com',
                phone: 'Contact via app',
                coverImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200',
            },
        });
        created++;
    }
    console.log(`Seeded ${created} real businesses (skipped existing).`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=seedRealBusinesses.js.map