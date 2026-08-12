/**
 * protocolV2.routes.ts — HTTP surface for the five Pabandi Protocol v2.0 pillars.
 *   /zk      ZK Nullifier Proof of Rent
 *   /act     ACTUS tokenized rent cashflow engine
 *   /arb     Kleros-style arbitration
 *   /dao     Aragon-style bicameral QV DAO
 *   /mesh    Data Mesh (CourtListener key pool)
 * All anchor artifacts on Solana (chain untouched — hash commitments only).
 */
import { Router, Request, Response } from 'express';
import { zkNullifierService } from '../services/zkNullifier.service';
import { actusEngine } from '../services/actusEngine.service';
import { klerosArbitration } from '../services/klerosArbitration.service';
import { aragonDao, VoteChoice } from '../services/aragonDao.service';
import { dataMesh } from '../services/dataMesh.service';

const router = Router();

// ── ZK Nullifier PoR ────────────────────────────────────────────────────────
router.post('/zk/issue', async (req: Request, res: Response): Promise<any> => {
  const { tenantDID, propertyDID, consecutiveMonths, secret } = req.body || {};
  if (!tenantDID || !propertyDID || !consecutiveMonths) return res.status(400).json({ success: false, error: 'tenantDID, propertyDID, consecutiveMonths required' });
  try { res.json({ success: true, data: await zkNullifierService.issueProof(tenantDID, propertyDID, consecutiveMonths, secret) }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});
router.post('/zk/verify', async (req: Request, res: Response): Promise<any> => {
  const v = await zkNullifierService.verifyProof(req.body || {});
  res.json({ success: true, data: v });
});

// ── ACTUS ───────────────────────────────────────────────────────────────────
router.post('/act/contract', async (req: Request, res: Response): Promise<any> => {
  const { tenantId, landlordId, principalUSD, apyPct, termMonths, startDate } = req.body || {};
  if (!tenantId || !landlordId || !principalUSD) return res.status(400).json({ success: false, error: 'tenantId, landlordId, principalUSD required' });
  try {
    const c = await actusEngine.createContract({ tenantId, landlordId, principalUSD, apyPct, termMonths, startDate });
    res.json({ success: true, data: { ...c, npv: actusEngine.npv(c) } });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Kleros-style Arbitration ─────────────────────────────────────────────────
router.post('/arb/open', async (req: Request, res: Response): Promise<any> => {
  const { disputeId, tenantId, landlordId, claim } = req.body || {};
  if (!disputeId || !tenantId || !landlordId) return res.status(400).json({ success: false, error: 'disputeId, tenantId, landlordId required' });
  res.json({ success: true, data: await klerosArbitration.openDispute(disputeId, tenantId, landlordId, claim || '') });
});
router.post('/arb/vote', async (req: Request, res: Response): Promise<any> => {
  const { disputeId, jurorId, stakePab, vote } = req.body || {};
  if (!disputeId || !jurorId || !vote) return res.status(400).json({ success: false, error: 'disputeId, jurorId, vote required' });
  try { res.json({ success: true, data: await klerosArbitration.castJurorVote(disputeId, jurorId, stakePab || 0, vote) }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});
router.post('/arb/resolve', async (req: Request, res: Response): Promise<any> => {
  const { disputeId } = req.body || {};
  if (!disputeId) return res.status(400).json({ success: false, error: 'disputeId required' });
  try { res.json({ success: true, data: await klerosArbitration.resolve(disputeId) }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});
router.post('/arb/appeal', async (req: Request, res: Response): Promise<any> => {
  const { disputeId, byParty, bondPab } = req.body || {};
  if (!disputeId) return res.status(400).json({ success: false, error: 'disputeId required' });
  try { res.json({ success: true, data: await klerosArbitration.appeal(disputeId, byParty || '', bondPab || 0) }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

// ── Aragon-style DAO ──────────────────────────────────────────────────────────
router.post('/dao/proposal', async (req: Request, res: Response): Promise<any> => {
  const { proposalId, title, body } = req.body || {};
  if (!proposalId || !title) return res.status(400).json({ success: false, error: 'proposalId, title required' });
  res.json({ success: true, data: await aragonDao.createProposal(proposalId, title, body || '') });
});
router.post('/dao/vote', async (req: Request, res: Response): Promise<any> => {
  const { proposalId, voterId, trustBand, stakedPpd, choice } = req.body || {};
  if (!proposalId || !voterId || !trustBand || !choice) return res.status(400).json({ success: false, error: 'proposalId, voterId, trustBand, choice required' });
  try { res.json({ success: true, data: await aragonDao.castVote(proposalId, voterId, trustBand, stakedPpd || 0, choice as VoteChoice) }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});
router.get('/dao/vote-power', (req: Request, res: Response): any => {
  const { trustBand, stakedPpd } = req.query as any;
  if (!trustBand) return res.status(400).json({ success: false, error: 'trustBand required' });
  res.json({ success: true, data: { power: aragonDao.votePower(trustBand, Number(stakedPpd) || 0) } });
});

// ── Data Mesh ─────────────────────────────────────────────────────────────────
router.get('/mesh/query', async (req: Request, res: Response): Promise<any> => {
  const { name, state } = req.query as any;
  if (!name) return res.status(400).json({ success: false, error: 'name required' });
  try { res.json({ success: true, data: await dataMesh.queryCivilLitigation(name, state) }); }
  catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});
router.get('/mesh/health', (_req: Request, res: Response): any => {
  res.json({ success: true, data: { keys: dataMesh.getKeyHealth() } });
});

export default router;
