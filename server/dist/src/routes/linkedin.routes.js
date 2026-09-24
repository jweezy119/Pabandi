"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const linkedinLeadGen_service_1 = require("../services/linkedinLeadGen.service");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/linkedin/generate-message
 * Generate a personalized icebreaker message for a prospect.
 * Body: { personaId, firstName, techStack?, mutualConnections? }
 */
router.post('/generate-message', async (req, res) => {
    const { personaId, firstName, techStack, mutualConnections } = req.body;
    const persona = linkedinLeadGen_service_1.LINKEDIN_PERSONAS.find(p => p.id === personaId);
    if (!persona) {
        return res.status(400).json({ success: false, error: 'Invalid personaId' });
    }
    if (!firstName) {
        return res.status(400).json({ success: false, error: 'firstName required' });
    }
    try {
        const message = linkedinLeadGen_service_1.linkedinLeadGenService.generateIcebreaker(persona, firstName, techStack, mutualConnections);
        res.json({ success: true, data: { message, persona: persona.name, valueProp: persona.valueProp } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/linkedin/schedule-posts
 * Schedule a batch of LinkedIn posts for a persona.
 * Body: { personaIds: string[], count: number }
 */
router.post('/schedule-posts', async (req, res) => {
    const { personaIds, count = 3 } = req.body;
    try {
        const personas = personaIds
            ? linkedinLeadGen_service_1.LINKEDIN_PERSONAS.filter(p => personaIds.includes(p.id))
            : linkedinLeadGen_service_1.LINKEDIN_PERSONAS;
        const scheduled = linkedinLeadGen_service_1.linkedinLeadGenService.scheduleContentBatch(personas, count);
        res.json({ success: true, data: { scheduled, count: scheduled.length } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/linkedin/capture-lead
 * Capture a lead from a LinkedIn post/ad → landing page form.
 * Body: { linkedinId, linkedinName, linkedinUrl, email, persona, source }
 */
router.post('/capture-lead', async (req, res) => {
    const { linkedinId, linkedinName, linkedinUrl, email, persona, source } = req.body;
    if (!linkedinId || !linkedinName) {
        return res.status(400).json({ success: false, error: 'linkedinId and linkedinName required' });
    }
    try {
        const lead = await linkedinLeadGen_service_1.linkedinLeadGenService.captureLead(linkedinId, linkedinName, linkedinUrl, email, persona || 'unknown', source || 'linkedin-post');
        // Auto-issue a free trust score assessment
        const assessmentUrl = `https://pabandi.app/trust-assessment?lead=${lead.leadId}`;
        res.json({
            success: true,
            data: {
                lead,
                assessmentUrl,
                message: 'Lead captured! Free trust score assessment ready.',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/linkedin/dm-campaign
 * Run a DM campaign to a list of prospects.
 * Body: { personaId, prospects: [{ linkedinId, firstName, techStack?, mutualConnections? }] }
 */
router.post('/dm-campaign', async (req, res) => {
    const { personaId, prospects } = req.body;
    const persona = linkedinLeadGen_service_1.LINKEDIN_PERSONAS.find(p => p.id === personaId);
    if (!persona || !prospects || !Array.isArray(prospects)) {
        return res.status(400).json({ success: false, error: 'personaId and prospects array required' });
    }
    try {
        const result = await linkedinLeadGen_service_1.linkedinLeadGenService.runDMCampaign(persona, prospects);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/linkedin/convert-lead
 * Convert a captured lead into a Pabandi business owner.
 * Body: { leadId, paymentMethod? }
 */
router.post('/convert-lead', async (req, res) => {
    const { leadId, paymentMethod } = req.body;
    if (!leadId) {
        return res.status(400).json({ success: false, error: 'leadId required' });
    }
    try {
        const result = await linkedinLeadGen_service_1.linkedinLeadGenService.convertLead(leadId, paymentMethod);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/linkedin/stats
 * Get lead-gen funnel stats.
 */
router.get('/stats', async (_req, res) => {
    try {
        const stats = linkedinLeadGen_service_1.linkedinLeadGenService.getStats();
        res.json({ success: true, data: stats });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/linkedin/personas
 * Get all target personas for LinkedIn outreach.
 */
router.get('/content-templates', async (_req, res) => {
    res.json({ success: true, data: linkedinLeadGen_service_1.CONTENT_TEMPLATES });
});
/**
 * GET /api/v1/linkedin/personas
 * Get all target personas for LinkedIn outreach.
 */
router.get('/personas', async (_req, res) => {
    res.json({
        success: true,
        data: linkedinLeadGen_service_1.LINKEDIN_PERSONAS.map(p => ({
            id: p.id,
            name: p.name,
            title: p.title,
            industries: p.industries,
            minConnections: p.minConnections,
            valueProp: p.valueProp,
        })),
    });
});
/**
 * POST /api/v1/linkedin/generate-role-post
 * Generate a role-specific hiring post for LinkedIn.
 * Body: { roleTitle, industry, companyName? }
 */
router.post('/generate-role-post', async (req, res) => {
    const { roleTitle, industry, companyName } = req.body;
    if (!roleTitle || !industry) {
        return res.status(400).json({ success: false, error: 'roleTitle and industry required' });
    }
    try {
        const post = linkedinLeadGen_service_1.linkedinLeadGenService.generateRolePost(roleTitle, industry, companyName);
        res.json({ success: true, data: { post, roleTitle, industry } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/linkedin/run-funnel
 * Run the full auto-funnel: schedule posts → auto-DM prospects → capture leads.
 * Body: { personas?: string[], postCount?: number, dmLimit?: number }
 */
router.post('/run-funnel', async (req, res) => {
    const { personas: personaIds, postCount = 3, dmLimit = 50 } = req.body;
    try {
        const personas = personaIds
            ? linkedinLeadGen_service_1.LINKEDIN_PERSONAS.filter(p => personaIds.includes(p.id))
            : linkedinLeadGen_service_1.LINKEDIN_PERSONAS;
        const result = await linkedinLeadGen_service_1.linkedinLeadGenService.runFullFunnel(personas, postCount, dmLimit);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/linkedin/stats
 * Get lead-gen funnel stats.
 */
router.get('/stats', async (_req, res) => {
    try {
        const stats = linkedinLeadGen_service_1.linkedinLeadGenService.getStats();
        res.json({ success: true, data: stats });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=linkedin.routes.js.map