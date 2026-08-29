"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const program_service_1 = require("../services/program.service");
const router = (0, express_1.Router)();
/** GET /api/v1/programs — list programs (with per-phase breakdown + progress) for the live UI. */
router.get('/', async (_req, res, next) => {
    try {
        const list = await program_service_1.programService.listPrograms();
        res.json({ success: true, data: list });
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/programs — decompose + budget a long, multi-task engagement into staffed tasks. */
router.post('/', async (req, res, next) => {
    try {
        const b = req.body || {};
        const r = await program_service_1.programService.createProgram({
            title: b.title, description: b.description, durationWeeks: b.durationWeeks,
            skillMix: b.skillMix, intensity: b.intensity, clientWallet: b.clientWallet, referralCode: b.referralCode || 'PABANDI',
        });
        res.json({ success: true, data: r });
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/programs/:id/staff — staff the next pending task (create its gig on the open board). */
router.post('/:id/staff', async (req, res, next) => {
    try {
        const r = await program_service_1.programService.staffNextTask(req.params.id);
        res.json({ success: true, data: r });
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/programs/:id/advance — run one autonomous step (complete finished tasks, staff next). */
router.post('/:id/advance', async (req, res, next) => {
    try {
        const r = await program_service_1.programService.runProgramLoop(req.params.id);
        res.json({ success: true, data: r });
    }
    catch (e) {
        next(e);
    }
});
/** GET /api/v1/programs/:id — program status + per-task progress. */
router.get('/:id', async (req, res, next) => {
    try {
        const r = await program_service_1.programService.programStatus(req.params.id);
        res.json({ success: true, data: r });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=program.routes.js.map