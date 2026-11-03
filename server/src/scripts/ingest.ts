require('dotenv').config();
import { ingestData, getJobProgress } from '../services/ingestion/pipeline.service';
import { logger } from '../utils/logger';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx > -1) {
        args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[arg.slice(2)] = argv[i + 1];
        i++;
      } else {
        args[arg.slice(2)] = 'true';
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source || args.s;
  const country = args.country || args.c;
  const state = args.state || args.s;
  const category = args.category || args.cat;
  const limit = parseInt(args.limit || args.l || '20', 10);

  if (!source) {
    console.error('Usage: npx tsx src/scripts/ingest.ts --source=opendirectories|apify|googlemaps --query="..." [--geo=...] [--radius=...] [--limit=20] [--country=US] [--state=TX] [--category=restaurant]');
    process.exitCode = 1;
    return;
  }

  if (!['opendirectories', 'apify', 'googlemaps'].includes(source)) {
    console.error(`Invalid source '${source}'. Must be 'opendirectories', 'apify', or 'googlemaps'.`);
    process.exitCode = 1;
    return;
  }

  logger.info(`Starting ingestion: source=${source} query=${args.query} country=${country} state=${state} category=${category} limit=${limit}`);

  const { jobId } = await ingestData(source, {
    query: args.query,
    country,
    state,
    category,
    limit,
    geo: args.geo,
    radius: args.radius ? parseInt(args.radius, 10) : undefined,
  });
  logger.info(`Ingestion job started: ${jobId}`);

  // Poll for completion
  let done = false;
  while (!done) {
    const job = getJobProgress(jobId);
    if (!job) {
      logger.error('Job not found');
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`\r  status=${job.status} fetched=${job.totalFetched} upserted=${job.totalUpserted} errors=${job.totalErrors} current=${job.currentBusiness || '-'}`);

    if (job.status === 'completed' || job.status === 'failed') {
      done = true;
    } else {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const job = getJobProgress(jobId)!;
  console.log('\n');
  console.log(`Ingestion complete:`);
  console.log(`  jobId:    ${job.jobId}`);
  console.log(`  source:   ${job.adapterId}`);
  console.log(`  status:   ${job.status}`);
  console.log(`  fetched:  ${job.totalFetched}`);
  console.log(`  upserted: ${job.totalUpserted}`);
  console.log(`  errors:   ${job.totalErrors}`);
  if (job.error) console.log(`  error:    ${job.error}`);

  process.exitCode = job.status === 'failed' ? 1 : 0;
}

main().catch((err) => {
  logger.error(`Ingestion script failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
