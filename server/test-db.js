const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.trustPassport.findMany({ take: 3, select: { id: true, paymentScore: true, showUpScore: true, deliveryScore: true } }).then(res => { console.log(res); process.exit(0); });
