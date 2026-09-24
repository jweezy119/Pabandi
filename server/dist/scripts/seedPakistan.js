"use strict";
/**
 * Pakistan Business Seeder
 * Seeds 50+ businesses across major Pakistan cities with realistic data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
// Pakistan cities with coordinates
const PAKISTAN_CITIES = [
    { name: 'Karachi', lat: 24.8607, lng: 67.0011, province: 'Sindh' },
    { name: 'Lahore', lat: 31.5204, lng: 74.3587, province: 'Punjab' },
    { name: 'Islamabad', lat: 33.6844, lng: 73.0479, province: 'ICT' },
    { name: 'Faisalabad', lat: 31.4504, lng: 73.1350, province: 'Punjab' },
    { name: 'Rawalpindi', lat: 33.5651, lng: 73.0169, province: 'Punjab' },
    { name: 'Peshawar', lat: 34.0151, lng: 71.5249, province: 'KPK' },
    { name: 'Multan', lat: 30.1575, lng: 71.5249, province: 'Punjab' },
    { name: 'Quetta', lat: 30.1798, lng: 66.9750, province: 'Balochistan' },
    { name: 'Hyderabad', lat: 25.3960, lng: 68.3578, province: 'Sindh' },
    { name: 'Sialkot', lat: 32.5000, lng: 74.5333, province: 'Punjab' },
    { name: 'Gujranwala', lat: 32.1877, lng: 74.1945, province: 'Punjab' },
    { name: 'Sukkur', lat: 27.7000, lng: 68.8500, province: 'Sindh' },
    { name: 'Bahawalpur', lat: 29.3956, lng: 71.6836, province: 'Punjab' },
];
// Business names by category
const BUSINESS_NAMES = {
    restaurant: [
        'BBQ Tonight', 'Salt\'n Pepper', 'Cafe Butt', 'Butt Karahi', 'Lasani Restaurant',
        'A1 Chapli Kebab', 'Lahore Chatkharay', 'Karachi Darbar', 'Islamabad Biryani House',
        'Food Street Express', 'Haveli Restaurant', 'Nando\'s', 'KFC', 'McDonald\'s',
        'Pizza Hut', 'Shiraz Grill', 'Al Habib Restaurant', 'Ghaffar Kabab House',
        'Rehman Baba Restaurant', 'Sajji House', 'Peshawari Chapli Kebab', 'Pizza Online',
        'Royal Tikka', 'Chatkharay', 'Biryani King', 'Malai Boti', 'Chargha House',
    ],
    retail: [
        'Al-Fatah', 'Naheed Super Market', 'Imtiaz Super Market', 'Metro Cash & Carry',
        'Carrefour', 'Habib Mart', 'Chase Value Centre', 'Makro Center',
        'Agha\'s Supermarket', 'Al Jadeed Store', 'Malik Electronics', 'Hussain Sons',
        'Shaheen Chemist', 'HomeDecor PK', 'Fashion Tower', 'Junaid Jamshed',
        'Sana Safinaz', 'Gul Ahmed', 'Khaadi', 'Sapphire',
    ],
    service: [
        'Ali Tailors', 'Habib Dry Cleaners', 'City Cabs', 'Careem Service Center',
        'Uber Support Hub', 'Jazz Franchise', 'Telenor Store', 'Zong Franchise',
        'Ufone Service Center', 'PTCL Customer Care', 'TCS Express', 'Leopards Courier',
        'DHL Pakistan', 'FedEx Office', 'Pakistan Post Office', 'NBP Bank',
        'HBL Branch', 'Allied Bank', 'Meezan Bank', 'UBL Omni',
    ],
    healthcare: [
        'Aga Khan Hospital', 'Shaukat Khanum', 'Jinnah Hospital', 'Services Hospital',
        'Liaquat National Hospital', 'Ziauddin Hospital', 'South City Hospital',
        'National Hospital', 'Al-Shifa Eye Hospital', 'Children\'s Hospital',
        'Lady Dufferin Hospital', 'Civil Hospital', 'Punjab Cardiology Institute',
        'Pakistan Kidney Institute', 'Heart Foundation', 'Shifa International',
        'Islamabad Diagnostic Centre', 'Chugtai Lab', 'Agha Lab', 'Excel Lab',
    ],
    education: [
        'LUMS', 'FAST-NU', 'NUST', 'GIKI', 'IBA Karachi',
        'Punjab University', 'Karachi University', 'Quaid-e-Azam University',
        'Air University', 'COMSATS', 'Bahria University', 'FAST Islamabad',
        'Habib University', 'Forman Christian College', 'Lahore School of Economics',
        'Beaconhouse School', 'The City School', 'Roots Millennium', 'Allied School',
    ],
    other: [
        'Pearl Continental Hotel', 'Marriott Hotel', 'Serena Hotel', 'Avari Hotel',
        'Ramada Hotel', 'Hotel One', 'Best Western', 'Marinso Chalets',
        'Lake View Park', 'Jinnah Park', 'Fatima Jinnah Park', 'Ayub Park',
        'Mohenjo-Daro Museum', 'Lahore Museum', 'Pakistan Monument', 'Faisal Mosque',
        'Badshahi Mosque', 'Shah Faisal Mosque', 'Data Darbar', 'Abdullah Shah Ghazi',
    ],
};
// Generate phone number in PK format
function generatePhone() {
    const prefixes = ['300', '301', '302', '303', '304', '305', '306', '307', '308', '309',
        '310', '311', '312', '313', '314', '315', '316', '317', '318', '319',
        '320', '321', '322', '323', '324', '325', '330', '331', '332', '333',
        '334', '335', '336', '337', '338', '339', '340', '341', '342', '343',
        '344', '345', '346', '347', '348', '349', '350', '351', '352', '355'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(1000000 + Math.random() * 9000000).toString();
    return `+92${prefix}${suffix}`;
}
// Generate realistic address
function generateAddress(city) {
    const areas = {
        'Karachi': ['Gulshan-e-Iqbal', 'Clifton', 'Defence', 'North Nazimabad', 'Korangi', 'Malir', 'Saddar', 'Lyari', 'PECHS', 'Tariq Road'],
        'Lahore': ['Gulberg', 'Model Town', 'Johar Town', 'DHA', 'Bahria Town', 'Township', 'Thokar Niaz Baig', 'Mughalpura', 'Anarkali', 'Ichra'],
        'Islamabad': ['F-7', 'F-8', 'F-10', 'F-11', 'G-9', 'G-10', 'G-11', 'I-8', 'I-10', 'Blue Area', 'Bahria Town'],
        'Faisalabad': ['Civil Lines', 'Gulberg', 'Madina Town', 'Jaranwala Road', 'Susan Road', 'Millat Town', 'Sargodha Road'],
        'Rawalpindi': ['Saddar', 'Raja Bazaar', 'Commercial Market', 'Bahria Town', 'Westridge', 'Asghar Mall Road'],
        'Peshawar': ['University Road', 'Hayatabad', ' Saddar', 'Cantt', 'Phase 1', 'Phase 2', 'Phase 3'],
        'Multan': ['Cantt', 'Gulgasht', 'Bosan Road', 'Shah Rukn-e-Alam', 'Muzaffarabad Road', 'Lodhi Colony'],
        'Quetta': ['Jinnah Road', 'Muzaffarabad Road', 'Satellite Town', 'Cantt', 'Sariab Road'],
        'Hyderabad': ['Latifabad', 'Qasimabad', 'Cantt', 'Station Road', 'Auto Bhawan Road'],
        'Sialkot': ['Paris Road', 'Kashmir Road', 'Saidpur Road', 'Small Industrial Estate', 'Airport Road'],
        'Gujranwala': ['GT Road', 'Satellite Town', 'People\'s Colony', 'Model Town', 'Wapda Town'],
        'Sukkur': ['Military Road', 'Minara Road', 'Shikarpur Road', 'Lansdowne Street', 'Barrage Colony'],
        'Bahawalpur': ['Farid Gate', 'Model Town', 'Satellite Town', 'Dera Adda', 'Khawaja Pur'],
    };
    const cityAreas = areas[city] || ['Main Area'];
    const area = cityAreas[Math.floor(Math.random() * cityAreas.length)];
    const streetNum = Math.floor(1 + Math.random() * 200);
    const blockLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `${streetNum}, ${blockLetter} Block, ${area}, ${city}`;
}
// Generate business hours in PKT
function generateHours() {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const hours = {};
    for (const day of days) {
        const isClosed = day === 'sun' && Math.random() > 0.7;
        const openHour = day === 'fri' ? 13 : 10 + Math.floor(Math.random() * 3); // Later on Friday
        const closeHour = 22 + Math.floor(Math.random() * 4); // 22:00 - 01:00
        hours[day] = {
            closed: isClosed,
            open: `${openHour}:00`,
            close: `${closeHour}:00`,
        };
    }
    return JSON.stringify(hours);
}
// Generate price range
function generatePriceRange(category) {
    const ranges = {
        restaurant: ['$', '$$', '$$$'],
        retail: ['$', '$$'],
        service: ['$', '$$', '$$$'],
        healthcare: ['$$', '$$$', '$$$$'],
        education: ['$', '$$', '$$$'],
        other: ['$', '$$', '$$$', '$$$$'],
    };
    const range = ranges[category] || ['$'];
    return range[Math.floor(Math.random() * range.length)];
}
// Main seeder function
async function seedPakistanBusinesses() {
    console.log('🇵🇰 Starting Pakistan Business Seeder...\n');
    const categories = ['RESTAURANT', 'RETAIL', 'SERVICE', 'HEALTHCARE', 'EDUCATION', 'OTHER'];
    const targetPerCategory = {
        RESTAURANT: 15,
        RETAIL: 10,
        SERVICE: 10,
        HEALTHCARE: 5,
        EDUCATION: 5,
        OTHER: 5,
    };
    let totalCreated = 0;
    for (const category of categories) {
        const count = targetPerCategory[category];
        console.log(`\n📦 Seeding ${count} ${category} businesses...`);
        for (let i = 0; i < count; i++) {
            const city = PAKISTAN_CITIES[Math.floor(Math.random() * PAKISTAN_CITIES.length)];
            const businessNames = BUSINESS_NAMES[category.toLowerCase()] || BUSINESS_NAMES.other;
            const name = businessNames[Math.floor(Math.random() * businessNames.length)];
            // Add suffix to avoid duplicates
            const uniqueName = i > 0 && count > 1 ? `${name} ${city.name}` : name;
            const lat = city.lat + (Math.random() - 0.5) * 0.1;
            const lng = city.lng + (Math.random() - 0.5) * 0.1;
            const business = {
                name: uniqueName,
                category: category,
                address: generateAddress(city.name),
                city: city.name,
                country: 'Pakistan',
                phone: generatePhone(),
                email: `info@${uniqueName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.pk`,
                website: `https://${uniqueName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.pk`,
                description: `Premium ${category.toLowerCase()} services in ${city.name}, Pakistan. Serving customers across ${city.province}.`,
                latitude: lat,
                longitude: lng,
                timezone: 'Asia/Karachi',
                currency: 'PKR',
                isVerified: Math.random() > 0.3,
                isActive: true,
                source: 'pakistan_seeder',
                hoursJson: generateHours(),
                priceRange: generatePriceRange(category.toLowerCase()),
                languages: ['ur', 'en'],
                paymentMethods: ['cash', 'jazzcash', 'easypaisa', 'bank'],
            };
            try {
                await prisma.business.create({ data: business });
                totalCreated++;
                process.stdout.write(`  ✓ ${uniqueName} (${city.name})\r`);
            }
            catch (error) {
                console.log(`\n  ✗ Failed: ${uniqueName} - ${error.message}`);
            }
        }
    }
    console.log(`\n\n✅ Successfully seeded ${totalCreated} Pakistan businesses!`);
    // Print summary by city
    const byCity = await prisma.business.groupBy({
        by: ['city'],
        where: { country: 'Pakistan' },
        _count: { id: true },
    });
    console.log('\n📊 Businesses by City:');
    for (const city of byCity.sort((a, b) => b._count.id - a._count.id)) {
        console.log(`   ${city.city}: ${city._count.id} businesses`);
    }
    // Print summary by category
    const byCategory = await prisma.business.groupBy({
        by: ['category'],
        where: { country: 'Pakistan' },
        _count: { id: true },
    });
    console.log('\n📊 Businesses by Category:');
    for (const cat of byCategory.sort((a, b) => b._count.id - a._count.id)) {
        console.log(`   ${cat.category}: ${cat._count.id} businesses`);
    }
}
// Geocode addresses using Nominatim
async function geocodeAddresses() {
    console.log('\n🌍 Geocoding business addresses...');
    const businesses = await prisma.business.findMany({
        where: { country: 'Pakistan', latitude: null },
    });
    for (const business of businesses) {
        try {
            const address = `${business.address}, ${business.city}, Pakistan`;
            const response = await axios_1.default.get('https://nominatim.openstreetmap.org/search', {
                params: { q: address, format: 'json', limit: 1 },
                headers: { 'User-Agent': 'Pabandi/1.0' },
            });
            if (response.data.length > 0) {
                const result = response.data[0];
                await prisma.business.update({
                    where: { id: business.id },
                    data: {
                        latitude: parseFloat(result.lat),
                        longitude: parseFloat(result.lon),
                    },
                });
            }
            // Rate limit: 1 request per second
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        catch (error) {
            console.log(`  ✗ Geocode failed for ${business.name}: ${error.message}`);
        }
    }
    console.log(`  Geocoded ${businesses.length} addresses`);
}
// Run seeder
async function main() {
    try {
        await seedPakistanBusinesses();
        // Optionally geocode (commented out for speed - uses Nominatim which has rate limits)
        // await geocodeAddresses();
        console.log('\n🎉 Pakistan Business Seeding Complete!');
    }
    catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=seedPakistan.js.map