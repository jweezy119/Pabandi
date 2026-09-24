"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// POST /api/v1/property/documents — upload a document record.
router.post('/documents', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const { title, fileName, fileUrl, fileSize, mimeType, category, tenantEmail, applicationId, leaseId } = req.body || {};
        if (!title || !fileName || !fileUrl)
            return res.status(400).json({ error: 'title, fileName, fileUrl are required' });
        const document = await prisma.tenantDocument.create({
            data: {
                managerId: profile.id,
                title,
                fileName,
                fileUrl,
                fileSize: fileSize || 0,
                mimeType: mimeType || null,
                category: category || 'OTHER',
                tenantEmail: tenantEmail ? String(tenantEmail).toLowerCase().trim() : null,
                applicationId: applicationId || null,
                leaseId: leaseId || null,
                uploadedBy: 'MANAGER',
            },
        });
        res.status(201).json({ success: true, data: document });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not upload document' });
    }
});
// GET /api/v1/property/documents?tenantEmail=...&category=... — list documents.
router.get('/documents', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const { tenantEmail, category } = req.query;
        const documents = await prisma.tenantDocument.findMany({
            where: {
                managerId: profile.id,
                ...(tenantEmail && { tenantEmail: tenantEmail }),
                ...(category && { category: category }),
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: documents });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/v1/property/documents/:id — delete a document.
router.delete('/documents/:id', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        await prisma.tenantDocument.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Document deleted' });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not delete document' });
    }
});
exports.default = router;
//# sourceMappingURL=document.routes.js.map