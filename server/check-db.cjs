const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
(async () => {
  console.log('=== DATABASE BACKGROUND CHECK ===');
  console.log('Timestamp:', new Date().toISOString());
  
  // Basic business statistics
  const totalBusinesses = await p.business.count();
  console.log('\n📊 BUSINESS STATISTICS');
  console.log('Total businesses:', totalBusinesses);
  
  // Business status breakdown
  const activeBusinesses = await p.business.count({ where: { isActive: true } });
  const inactiveBusinesses = await p.business.count({ where: { isActive: false } });
  console.log('Active businesses:', activeBusinesses);
  console.log('Inactive businesses:', inactiveBusinesses);
  console.log('Activation rate: %', ((activeBusinesses / totalBusinesses) * 100).toFixed(2));
  
  // Geolocation data quality
  const businessesWithGeo = await p.business.count({
    where: { 
      latitude: { not: null }, 
      longitude: { not: null },
      latitude: { gt: -90, lt: 90 },
      longitude: { gt: -180, lt: 180 }
    } 
  });
  console.log('\n🌍 GEOLOCATION DATA');
  console.log('Businesses with valid coordinates:', businessesWithGeo);
  console.log('Geolocation completeness: %', ((businessesWithGeo / totalBusinesses) * 100).toFixed(2));
  
  // Category distribution
  const categoryStats = await p.business.groupBy({
    by: ['category'],
    _count: { id: true }
  });
  console.log('\n📋 CATEGORY DISTRIBUTION');
  categoryStats.forEach(cat => {
    console.log(`${cat.category}: ${cat._count.id} (${((cat._count.id / totalBusinesses) * 100).toFixed(2)}%)`);
  });
  
  // Top businesses by rating (active only)
  const topBusinesses = await p.business.findMany({
    take: 5, 
    orderBy: { rating: 'desc' }, 
    where: { isActive: true },
    select: { 
      id: true, 
      name: true, 
      category: true, 
      city: true, 
      latitude: true, 
      longitude: true, 
      rating: true, 
      trustScore: true,
      createdAt: true,
      _count: { select: { reviews: true, bookings: true } }
    }
  });
  console.log('\n🏆 TOP 5 BUSINESSES BY RATING');
  topBusinesses.forEach((biz, index) => {
    console.log(`${index + 1}. ${biz.name} (${biz.category}) - Rating: ${biz.rating}, Trust: ${biz.trustScore}, Reviews: ${biz._count.reviews}, Bookings: ${biz._count.bookings}`);
  });
  
  // User account statistics
  const totalUsers = await p.user.count();
  console.log('\n👥 USER STATISTICS');
  console.log('Total users:', totalUsers);
  
  // User role distribution
  const userRoleStats = await p.user.groupBy({
    by: ['role'],
    _count: { id: true }
  });
  console.log('User roles:', userRoleStats.map(r => `${r.role}: ${r._count.id}`).join(', '));
  
  // Businesses with reviews and bookings
  const businessesWithActivity = await p.business.findMany({
    where: { 
      isActive: true,
      reviews: { some: {} },
      bookings: { some: {} }
    },
    select: { id: true, name: true, _count: { select: { reviews: true, bookings: true } } }
  });
  console.log('\n📈 ACTIVE BUSINESS ACTIVITY');
  console.log('Businesses with both reviews and bookings:', businessesWithActivity.length);
  
  // Database size estimates (approximate)
  const totalReviews = await p.review.count();
  const totalBookings = await p.booking.count();
  const totalPayments = await p.payment.count();
  console.log('\n💾 DATABASE SIZE');
  console.log('Reviews:', totalReviews);
  console.log('Bookings:', totalBookings);
  console.log('Payments:', totalPayments);
  console.log('Estimated total records: %d', totalBusinesses + totalUsers + totalReviews + totalBookings + totalPayments);
  
  // Location accuracy check
  const locationAccuracy = await p.business.groupBy({
    by: ['city'],
    _count: { id: true },
    where: {
      latitude: { not: null },
      longitude: { not: null }
    }
  });
  console.log('\n🗺️ LOCATION BY CITY');
  locationAccuracy.forEach(loc => {
    console.log(`${loc.city}: ${loc._count.id} businesses with coordinates`);
  });
  
  // Health indicators
  const healthIndicators = {
    activeRate: (activeBusinesses / totalBusinesses) * 100,
    geoCompleteness: (businessesWithGeo / totalBusinesses) * 100,
    businessWithActivity: (businessesWithActivity.length / totalBusinesses) * 100
  };
  
  console.log('\n⚕️ DATABASE HEALTH INDICATORS');
  console.log(`Active business rate: ${healthIndicators.activeRate.toFixed(2)}%`);
  console.log(`Geolocation completeness: ${healthIndicators.geoCompleteness.toFixed(2)}%`);
  console.log(`Businesses with activity: ${healthIndicators.businessWithActivity.toFixed(2)}%`);
  
  const overallHealthScore = (healthIndicators.activeRate + healthIndicators.geoCompleteness + healthIndicators.businessWithActivity) / 3;
  console.log(`Overall health score: ${overallHealthScore.toFixed(2)}%`);
  
  // System warnings
  console.log('\n⚠️ SYSTEM WARNINGS');
  if (healthIndicators.activeRate < 80) {
    console.log('WARNING: Low business activation rate (< 80%)');
  }
  if (healthIndicators.geoCompleteness < 50) {
    console.log('WARNING: Poor geolocation data completeness (< 50%)');
  }
  if (healthIndicators.businessWithActivity < 20) {
    console.log('WARNING: Low business activity rate (< 20%)');
  }
  
  console.log('\n✅ DATABASE BACKGROUND CHECK COMPLETED');
  console.log('Timestamp:', new Date().toISOString());
  await p.$disconnect();
})().catch(e => {
  console.error('❌ ERROR during database check:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
});
