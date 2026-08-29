"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyForJob = exports.getJobDetails = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
/**
 * Get details for a specific job posting (Public Route)
 * Used by the ATS landing page
 */
const getJobDetails = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await database_1.prisma.jobPosting.findUnique({
            where: { id: jobId }
        });
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        if (job.status !== 'PUBLISHED' && job.expiresAt < new Date()) {
            return res.status(404).json({ success: false, error: 'Job is no longer active' });
        }
        res.json({ success: true, data: job });
    }
    catch (error) {
        logger_1.logger.error('Error fetching job details', error);
        res.status(500).json({ success: false, error: 'Failed to fetch job details' });
    }
};
exports.getJobDetails = getJobDetails;
/**
 * Apply for a job (Authenticated Route)
 * Users are redirected here after being forced to create an account
 */
const applyForJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { resumeUrl } = req.body;
        const userId = req.user.id; // from auth middleware
        const job = await database_1.prisma.jobPosting.findUnique({
            where: { id: jobId }
        });
        if (!job || job.status !== 'PUBLISHED') {
            return res.status(404).json({ success: false, error: 'Job not available' });
        }
        // Check if already applied
        const existingApplication = await database_1.prisma.jobApplication.findFirst({
            where: { jobId, applicantId: userId }
        });
        if (existingApplication) {
            return res.status(400).json({ success: false, error: 'You have already applied for this job' });
        }
        const application = await database_1.prisma.jobApplication.create({
            data: {
                jobId,
                applicantId: userId,
                resumeUrl
            }
        });
        res.json({
            success: true,
            message: 'Application submitted successfully',
            data: application
        });
    }
    catch (error) {
        logger_1.logger.error('Error applying for job', error);
        res.status(500).json({ success: false, error: 'Failed to submit application' });
    }
};
exports.applyForJob = applyForJob;
//# sourceMappingURL=jobs.controller.js.map