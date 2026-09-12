const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
(async () => {
  const total = await p.business.count();
  console.log('total:', total);
  const withGeo = await p.business.count({ where: { latitude: { not: null }, longitude: { not: null } } });
  console.log('with_geo:', withGeo);
  const cats = await p.business.findMany({ select: { category: true }, distinct: ['category'] });
  console.log('cats:', cats.map(x => x.category).join(','));
  const top = await p.business.findMany({
    take: 3, orderBy: { rating: 'desc' }, where: { isActive: true },
    select: { id: true, name: true, category: true, city: true, latitude: true, longitude: true, rating: true, trustScore: true }
  });
  console.log('top:', JSON.stringify(top, null, 2));
  await p.$disconnect();
})().catch(e => console.error(e.message));
