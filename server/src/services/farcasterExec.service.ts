import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

/**
 * Safe Farcaster execution wrapper (parallel to socialExec for X).
 *
 * HONEST NOTE: Farcaster requires an authorized signer key to post. There is no
 * free, no-signup public posting endpoint. So this executor is DRY_RUN by default
 * and logs the exact action it WOULD take. To go live you must:
 *   1. Run a Farcaster signer (e.g. `farcaster-dev` / hub + approved signer, or a
 *      hosted tool) and expose a CLI or set FARCASTER_CLI + credentials locally.
 *   2. Set FARCASTER_LIVE=true.
 * The agent NEVER handles your Farcaster credentials — same guardrail as xurl.
 */
const DRY_RUN = (process.env.FARCASTER_LIVE || 'false').toLowerCase() !== 'true';
const CLI = process.env.FARCASTER_CLI || 'farcaster'; // override if your tool differs

export type FarcasterAction =
  | { kind: 'post'; text: string }
  | { kind: 'reply'; castHash: string; text: string }
  | { kind: 'like'; castHash: string }
  | { kind: 'repost'; castHash: string };

function toArgs(a: FarcasterAction): string[] {
  switch (a.kind) {
    case 'post': return ['cast', 'post', '--text', a.text];
    case 'reply': return ['cast', 'reply', '--hash', a.castHash, '--text', a.text];
    case 'like': return ['cast', 'like', '--hash', a.castHash];
    case 'repost': return ['cast', 'repost', '--hash', a.castHash];
  }
}

export interface FarcasterResult { dryRun: boolean; command: string; executed: boolean; output?: string; error?: string; }

export const farcasterExec = {
  isDryRun: () => DRY_RUN,

  async run(action: FarcasterAction): Promise<FarcasterResult> {
    const args = toArgs(action);
    const command = `${CLI} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    if (DRY_RUN) {
      logger.info(`[Farcaster:DRY_RUN] would run: ${command}`);
      return { dryRun: true, command, executed: false };
    }
    try {
      const { stdout, stderr } = await execFileAsync(CLI, args, { timeout: 30_000 });
      const out = (stdout || stderr || '').trim();
      logger.info(`[Farcaster:LIVE] ${command} -> ${out.slice(0, 200)}`);
      return { dryRun: false, command, executed: true, output: out };
    } catch (e: any) {
      logger.error(`[Farcaster:LIVE] failed: ${command} :: ${e.message}`);
      return { dryRun: false, command, executed: false, error: e.message };
    }
  },

  /** Search casts (dry-run returns []). Real impl depends on your Farcaster tooling. */
  async search(_query: string, _n = 10): Promise<{ dryRun: boolean; query: string; casts: any[]; error?: string }> {
    const command = `${CLI} cast search "${_query}" -n ${_n}`;
    if (DRY_RUN) {
      logger.info(`[Farcaster:DRY_RUN] would run: ${command}`);
      return { dryRun: true, query: _query, casts: [] };
    }
    // Live search left as a hook — wire to your Farcaster indexer/hub reader.
    return { dryRun: false, query: _query, casts: [] };
  },
};

export default farcasterExec;
