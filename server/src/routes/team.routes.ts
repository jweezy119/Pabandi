import { Router } from 'express';
import { TeamService } from '../services/team.service';
import { parsePagination, withTotal } from '../utils/pagination';
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
    const { search, role, isActive, sortBy, sortOrder } = req.query;
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const { members, total } = await TeamService.getTeamMembers(businessId, {
      search: typeof search === 'string' ? search : undefined,
      role: typeof role === 'string' && role !== 'all' ? role : undefined,
      // Only 'true' or 'false' filter. Any other value leaves the roster whole, so a
      // typo does not silently hide everyone.
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      sortBy: typeof sortBy === 'string' ? sortBy : undefined,
      sortOrder: typeof sortOrder === 'string' ? sortOrder : undefined,
      skip: pagination?.skip,
      take: pagination?.take,
    });

    res.json({
      success: true,
      data: members,
      pagination: pagination ? withTotal(pagination, total) : null,
    });
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
