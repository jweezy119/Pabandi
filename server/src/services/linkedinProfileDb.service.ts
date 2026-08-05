import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/linkedin_profiles.db');

let db: Database.Database | null = null;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS linkedin_profiles (
      id TEXT PRIMARY KEY,
      linkedin_id TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      headline TEXT,
      company TEXT,
      industry TEXT,
      location TEXT,
      category TEXT,
      github_url TEXT,
      linkedin_url TEXT,
      connection_count INTEGER DEFAULT 0,
      trust_velocity REAL DEFAULT 0,
      trust_band TEXT DEFAULT 'D',
      profile_completeness REAL DEFAULT 0.8,
      seed_source TEXT DEFAULT 'GITHUB',
      persona TEXT,
      wallet_address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_category ON linkedin_profiles(category);
    CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_created_at ON linkedin_profiles(created_at);
  `);
}

export async function initLinkedInProfileDb() {
  try {
    const database = getDb();
    const count = database.prepare('SELECT COUNT(*) as c FROM linkedin_profiles').get() as any;
    if ((count?.c || 0) === 0) {
      console.log('[LinkedInProfileDB] Database empty, seeding from local JSON...');
      const { LinkedInProfileSeeder } = await import('../services/linkedinProfileSeeder.service');
      const { LINKEDIN_PERSONAS } = await import('../services/linkedinLeadGen.service');
      const seeder = new LinkedInProfileSeeder();
      const local = seeder.loadLocalSeedData();
      const insert = database.prepare(`
        INSERT OR REPLACE INTO linkedin_profiles
        (id, linkedin_id, first_name, last_name, headline, company, industry, location, category, github_url, trust_band, profile_completeness, seed_source, persona)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = database.transaction(() => {
        for (const p of LINKEDIN_PERSONAS) {
          const list = local.filter((raw: any) => raw.category === p.id);
          for (const raw of list) {
            const id = (raw as any).linkedinId || `local-${raw.login}`;
            const first = raw.login?.split(/[-_]/).filter(Boolean)[0] || raw.login || 'User';
            const last = raw.login?.split(/[-_]/).filter(Boolean).slice(1).join('-') || '';
            insert.run(
              id,
              id,
              first,
              last,
              raw.headline || 'Developer',
              raw.company || '',
              raw.headline?.includes('Designer') ? 'Design' : 'Software Development',
              raw.location || '',
              p.id,
              raw.githubUrl || '',
              'D',
              0.8,
              'GITHUB',
              p.id
            );
          }
        }
      });
      tx();
      console.log(`[LinkedInProfileDB] Seeded ${local.length} profiles`);
    }
    console.log(`[LinkedInProfileDB] Ready. Profiles: ${count?.c || 0}`);
  } catch (e: any) {
    console.error('[LinkedInProfileDB] Init failed:', e.message);
  }
}

export async function getLinkedInProfilesFromDb(category?: string) {
  const database = getDb();
  const where = category ? 'WHERE category = ?' : '';
  const params: any[] = category ? [category] : [];
  const rows = database.prepare(`SELECT * FROM linkedin_profiles ${where} ORDER BY datetime(created_at) DESC`).all(...params) as any[];
  return rows.map((r: any) => ({
    linkedinId: r.linkedin_id,
    firstName: r.first_name,
    lastName: r.last_name,
    headline: r.headline,
    company: r.company,
    location: r.location,
    category: r.category,
    githubUrl: r.github_url,
    walletAddress: r.wallet_address || null,
    trustVelocity: r.trust_velocity ?? 0,
    connectionCount: r.connection_count,
    profileCompleteness: r.profile_completeness,
  }));
}

export async function upsertLinkedInProfile(profile: any) {
  const database = getDb();
  database.prepare(`
    INSERT OR REPLACE INTO linkedin_profiles
    (id, linkedin_id, first_name, last_name, headline, company, industry, location, category, github_url, trust_band, profile_completeness, seed_source, persona, wallet_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    profile.linkedinId,
    profile.linkedinId,
    profile.firstName,
    profile.lastName || '',
    profile.headline || '',
    profile.company || '',
    profile.industry || '',
    profile.location || '',
    profile.category || 'freelance-dev',
    profile.githubUrl || '',
    profile.trustBand || 'D',
    profile.profileCompleteness ?? 0.8,
    'GITHUB',
    profile.category || 'freelance-dev',
    profile.walletAddress || null
  );
}

export async function getLinkedInProfileDbCount() {
  const database = getDb();
  const row = database.prepare('SELECT COUNT(*) as c FROM linkedin_profiles').get() as any;
  return row?.c || 0;
}
