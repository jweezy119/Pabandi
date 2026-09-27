import { Router } from 'express';
import { TeamService } from '../services/team.service';
import { requireRole } from '../middleware/permissions';

const router = Router();

// Routes needing ADMIN or above
router.post('/invite', requireRole('ADMIN'), async (req, res) => {
  try {
    const { businessId, name, email, role, payRate, payType } = req.body;
    const member = await TeamService.inviteMember({ businessId: String(businessId), name, email, role, payRate, payType });
    res.json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/deactivate', requireRole('ADMIN'), async (req, res) => {
  try {
    const businessId = String(req.query.businessId || req.body.businessId);
    const member = await TeamService.removeMember(req.params.id, businessId);
    res.json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/role', requireRole('ADMIN'), async (req, res) => {
  try {
    const businessId = String(req.query.businessId || req.body.businessId);
    const { role } = req.body;
    const member = await TeamService.updateMember(req.params.id, businessId, { role });
    res.json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Any team member with VIEWER or above can list
router.get('/', requireRole('VIEWER'), async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const members = await TeamService.getTeamMembers(businessId);
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireRole('VIEWER'), async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const member = await TeamService.getTeamMember(req.params.id, businessId);
    res.json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public invite accept
router.post('/accept-invite', async (req, res) => {
  try {
    const { token } = req.body;
    const member = await TeamService.acceptInvite(token);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
