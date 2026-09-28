const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.trustPassport.findUnique({ where: { id: 'cmskxzby2001w10fyajupxo7f' } }).then(res => { console.log(res); process.exit(0); });
