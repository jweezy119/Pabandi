"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = require("path");
const prisma = new client_1.PrismaClient();
async function main() {
    // Check if prisma_migrations table exists
    const tableExists = await prisma.$queryRaw `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'prisma_migrations'
    );
  `;
    if (!tableExists[0]?.exists) {
        console.log('Creating prisma_migrations table...');
        await prisma.$executeRaw `
      CREATE TABLE "prisma_migrations" (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        finished_at TIMESTAMPTZ,
        migration_name VARCHAR(255) NOT NULL,
        logs TEXT,
        rolled_back_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        steps_count INTEGER NOT NULL DEFAULT 1
      );
    `;
        console.log('prisma_migrations table created.');
    }
    // Get all migration folders
    const migrationsDir = (0, path_1.join)(process.cwd(), 'prisma', 'migrations');
    const migrationFolders = (0, fs_1.readdirSync)(migrationsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
    // Mark all existing migrations as applied
    for (const migration of migrationFolders) {
        const exists = await prisma.$queryRaw `
      SELECT COUNT(*) as count FROM prisma_migrations 
      WHERE migration_name = ${migration}
    `;
        if (Number(exists[0]?.count) === 0) {
            console.log(`Marking migration as applied: ${migration}`);
            await prisma.$executeRaw `
        INSERT INTO prisma_migrations (id, checksum, migration_name, finished_at, steps_count)
        VALUES (
          gen_random_uuid(), 
          'baseline', 
          ${migration}, 
          NOW(), 
          1
        )
      `;
        }
    }
    console.log('All existing migrations marked as applied.');
}
main()
    .catch((e) => {
    console.error('Baseline failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=baseline-db.js.map