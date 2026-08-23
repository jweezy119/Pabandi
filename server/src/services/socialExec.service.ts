import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

/**
 * Safe X/Twitter execution wrapper around the `xurl` CLI.
 *
 * SECURITY / COST GUARDRAILS (do not relax):
 *  - DRY_RUN is the DEFAULT. In dry-run, no command runs; we only log the exact
 *    `xurl ...` invocation that WOULD execute. Zero cost, no credentials needed.
 *  - LIVE mode only activates when process.env.SOCIAL_LIVE === 'true' AND `xurl`
 *    is installed + authenticated by the user manually. The agent NEVER handles
 *    the user's X credentials — xurl reads ~/.xurl itself.
 *  - We never pass secrets as CLI flags. Auth lives in ~/.xurl (user-managed).
 *  - We never use --verbose/-v (would leak auth headers).
 */
const DRY_RUN = (process.env.SOCIAL_LIVE || 'false').toLowerCase() !== 'true';

export type SocialAction =
  | { kind: 'post'; text: string; mediaId?: string }
  | { kind: 'reply'; postId: string; text: string }
  | { kind: 'quote'; postId: string; text: string }
  | { kind: 'like'; postId: string }
  | { kind: 'repost'; postId: string }
  | { kind: 'follow'; handle: string };

function toXurlArgs(action: SocialAction): { cmd: string; args: string[] } {
  switch (action.kind) {
    case 'post':
      return { cmd: 'xurl', args: action.mediaId
        ? ['post', action.text, '--media-id', action.mediaId]
        : ['post', action.text] };
    case 'reply':
      return { cmd: 'xurl', args: ['reply', action.postId, action.text] };
    case 'quote':
      return { cmd: 'xurl', args: ['quote', action.postId, action.text] };
    case 'like':
      return { cmd: 'xurl', args: ['like', action.postId] };
    case 'repost':
      return { cmd: 'xurl', args: ['repost', action.postId] };
    case 'follow':
      return { cmd: 'xurl', args: ['follow', action.handle] };
  }
}

export interface SocialResult {
  dryRun: boolean;
  command: string;
  executed: boolean;
  output?: string;
  error?: string;
}

export const socialExec = {
  isDryRun: () => DRY_RUN,

  /**
   * Execute (or simulate) a social action. Returns the command + result.
   * In DRY_RUN, never touches the network. In LIVE, runs xurl and captures JSON.
   */
  async run(action: SocialAction): Promise<SocialResult> {
    const { cmd, args } = toXurlArgs(action);
    const command = `${cmd} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    if (DRY_RUN) {
      logger.info(`[SocialExec:DRY_RUN] would run: ${command}`);
      return { dryRun: true, command, executed: false };
    }
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: 30_000 });
      const out = (stdout || stderr || '').trim();
      logger.info(`[SocialExec:LIVE] ${command} -> ${out.slice(0, 200)}`);
      return { dryRun: false, command, executed: true, output: out };
    } catch (e: any) {
      logger.error(`[SocialExec:LIVE] failed: ${command} :: ${e.message}`);
      return { dryRun: false, command, executed: false, error: e.message };
    }
  },

  /**
   * Search X (live) for posts to engage with. Dry-run returns [] + the query.
   * Returns raw post objects (ids, text) so the marketing agent can decide replies.
   */
  async search(query: string, n = 10): Promise<{ dryRun: boolean; query: string; posts: any[]; error?: string }> {
    const command = `xurl search "${query}" -n ${n}`;
    if (DRY_RUN) {
      logger.info(`[SocialExec:DRY_RUN] would run: ${command}`);
      return { dryRun: true, query, posts: [] };
    }
    try {
      const { stdout } = await execFileAsync('xurl', ['search', query, '-n', String(n)], { timeout: 30_000 });
      const parsed = JSON.parse(stdout || '{}');
      return { dryRun: false, query, posts: parsed.data || [] };
    } catch (e: any) {
      return { dryRun: false, query, posts: [], error: e.message };
    }
  },
};

export default socialExec;
