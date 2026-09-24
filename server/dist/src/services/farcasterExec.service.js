"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.farcasterExec = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = require("../utils/logger");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
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
function toArgs(a) {
    switch (a.kind) {
        case 'post': return ['cast', 'post', '--text', a.text];
        case 'reply': return ['cast', 'reply', '--hash', a.castHash, '--text', a.text];
        case 'like': return ['cast', 'like', '--hash', a.castHash];
        case 'repost': return ['cast', 'repost', '--hash', a.castHash];
    }
}
exports.farcasterExec = {
    isDryRun: () => DRY_RUN,
    async run(action) {
        const args = toArgs(action);
        const command = `${CLI} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
        if (DRY_RUN) {
            logger_1.logger.info(`[Farcaster:DRY_RUN] would run: ${command}`);
            return { dryRun: true, command, executed: false };
        }
        try {
            const { stdout, stderr } = await execFileAsync(CLI, args, { timeout: 30000 });
            const out = (stdout || stderr || '').trim();
            logger_1.logger.info(`[Farcaster:LIVE] ${command} -> ${out.slice(0, 200)}`);
            return { dryRun: false, command, executed: true, output: out };
        }
        catch (e) {
            logger_1.logger.error(`[Farcaster:LIVE] failed: ${command} :: ${e.message}`);
            return { dryRun: false, command, executed: false, error: e.message };
        }
    },
    /** Search casts (dry-run returns []). Real impl depends on your Farcaster tooling. */
    async search(_query, _n = 10) {
        const command = `${CLI} cast search "${_query}" -n ${_n}`;
        if (DRY_RUN) {
            logger_1.logger.info(`[Farcaster:DRY_RUN] would run: ${command}`);
            return { dryRun: true, query: _query, casts: [] };
        }
        // Live search left as a hook — wire to your Farcaster indexer/hub reader.
        return { dryRun: false, query: _query, casts: [] };
    },
};
exports.default = exports.farcasterExec;
//# sourceMappingURL=farcasterExec.service.js.map