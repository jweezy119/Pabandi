const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.invoiceTrustEvent.aggregate({ _count: true, _min: { createdAt: true }, _max: { createdAt: true } }).then(res => { console.log(res); process.exit(0); });
