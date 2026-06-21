import { prisma } from '../src/utils/database';
import { accioAgentService } from '../src/services/ai/accioAgent.service';

async function main() {
  const business = await prisma.business.findFirst();
  if (!business) {
    console.log('No businesses found in DB to test.');
    return;
  }
  
  console.log(`Testing discoverTrends for business: ${business.name} (${business.category})`);
  // Remove existing trend suggestions for this business to force a new AI generation
  await prisma.trendSuggestion.deleteMany({
    where: { businessId: business.id }
  });
  
  const suggestions = await accioAgentService.discoverTrends(business.id);
  console.log('AI Generated Trend Suggestions:');
  console.log(JSON.stringify(suggestions, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
