import { PrismaClient } from '@prisma/client';
import { LinkedInProfileSeeder } from '../services/linkedinProfileSeeder.service';
import { LINKEDIN_PERSONAS } from '../services/linkedinLeadGen.service';

const prisma = new PrismaClient();
const seeder = new LinkedInProfileSeeder();

function md5Hex(text: string): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(text).digest('hex').substring(0, 12);
}

async function main() {
  console.log('[Persist] Loading local seed data...');
  const local = seeder.loadLocalSeedData();
  console.log(`[Persist] Loaded ${local.length} raw profiles`);

  const byPersona: Record<string, number> = {};
  for (const persona of LINKEDIN_PERSONAS) {
    const personaProfiles = local.filter((p: any) => p.category === persona.id);
    console.log(`[Persist] ${persona.name}: ${personaProfiles.length} profiles`);

    let saved = 0;
    for (const raw of personaProfiles) {
      try {
        const linkedinId = md5Hex(raw.githubUrl || raw.login);
        const firstName = raw.login?.split(/[-_]/).filter(Boolean)[0] || raw.login || 'User';
        const lastName = raw.login?.split(/[-_]/).filter(Boolean).slice(1).join('-') || '';
        const headline = raw.headline || 'Developer';
        const trustBand = 'D';

        await prisma.linkedInProfile.upsert({
          where: { linkedinId },
          update: {
            firstName,
            lastName,
            headline,
            company: raw.company || '',
            industry: raw.headline?.includes('Designer') ? 'Design' : 'Software Development',
            location: raw.location || '',
            category: persona.id,
            githubUrl: raw.githubUrl || '',
            connectionCount: (raw as any).connectionCount || 0,
            trustVelocity: 0,
            trustBand,
            profileCompleteness: 0.8,
            seedSource: 'GITHUB',
            persona: persona.id,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            linkedinId,
            firstName,
            lastName,
            headline,
            company: raw.company || '',
            industry: raw.headline?.includes('Designer') ? 'Design' : 'Software Development',
            location: raw.location || '',
            category: persona.id,
            githubUrl: raw.githubUrl || '',
            connectionCount: (raw as any).connectionCount || 0,
            trustVelocity: 0,
            trustBand,
            profileCompleteness: 0.8,
            seedSource: 'GITHUB',
            persona: persona.id,
            isActive: true,
          },
        });
        saved++;
      } catch (e: any) {
        console.error(`[Persist] Failed to save ${raw.login}: ${e.message}`);
      }
    }

    byPersona[persona.id] = saved;
    console.log(`[Persist] Saved ${saved}/${personaProfiles.length} ${persona.name} profiles`);
  }

  const total = await prisma.linkedInProfile.count();
  console.log(`\n[Persist] Total LinkedInProfile records in DB: ${total}`);
  console.log('[Persist] Done');
}

main()
  .catch((e) => {
    console.error('[Persist] Fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
