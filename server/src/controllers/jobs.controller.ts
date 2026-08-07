import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * Get details for a specific job posting (Public Route)
 * Used by the ATS landing page
 */
export const getJobDetails = async (req: Request, res: Response): Promise<any> => {
  try {
    const { jobId } = req.params;

    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (job.status !== 'PUBLISHED' && job.expiresAt < new Date()) {
      return res.status(404).json({ success: false, error: 'Job is no longer active' });
    }

    res.json({ success: true, data: job });
  } catch (error: any) {
    logger.error('Error fetching job details', error);
    res.status(500).json({ success: false, error: 'Failed to fetch job details' });
  }
};

/**
 * Apply for a job (Authenticated Route)
 * Users are redirected here after being forced to create an account
 */
export const applyForJob = async (req: Request, res: Response): Promise<any> => {
  try {
    const { jobId } = req.params;
    const { resumeUrl } = req.body;
    const userId = req.user!.id; // from auth middleware

    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId }
    });

    if (!job || job.status !== 'PUBLISHED') {
      return res.status(404).json({ success: false, error: 'Job not available' });
    }

    // Check if already applied
    const existingApplication = await prisma.jobApplication.findFirst({
      where: { jobId, applicantId: userId }
    });

    if (existingApplication) {
      return res.status(400).json({ success: false, error: 'You have already applied for this job' });
    }

    const application = await prisma.jobApplication.create({
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
  } catch (error: any) {
    logger.error('Error applying for job', error);
    res.status(500).json({ success: false, error: 'Failed to submit application' });
  }
};
