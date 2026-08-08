import { Router, Request, Response } from 'express';
import { getJobDetails, applyForJob } from '../controllers/jobs.controller';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://pabandi.com';

// ── XML Feeds for Job Boards ───────────────────────────────────────────────

/**
 * GET /api/v1/jobs/feed/linkedin.xml
 * Generates an XML feed for automated job ingestion by LinkedIn and Indeed.
 */
router.get('/feed/linkedin.xml', async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.jobPosting.findMany({
      where: { status: 'PUBLISHED', expiresAt: { gt: new Date() } }
    });

    // Simple XML Builder for LinkedIn specs
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<source>\n`;
    xml += `  <publisher>Pabandi</publisher>\n`;
    xml += `  <publisherurl>${FRONTEND_URL}</publisherurl>\n`;
    xml += `  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

    for (const job of jobs) {
      xml += `  <job>\n`;
      xml += `    <title><![CDATA[${job.title}]]></title>\n`;
      xml += `    <date><![CDATA[${job.createdAt.toUTCString()}]]></date>\n`;
      xml += `    <referencenumber><![CDATA[${job.id}]]></referencenumber>\n`;
      xml += `    <url><![CDATA[${FRONTEND_URL}/jobs/${job.id}]]></url>\n`;
      xml += `    <company><![CDATA[${job.companyName}]]></company>\n`;
      xml += `    <city><![CDATA[${job.location}]]></city>\n`;
      xml += `    <state><![CDATA[]]></state>\n`;
      xml += `    <country><![CDATA[US]]></country>\n`;
      xml += `    <description><![CDATA[${job.description}]]></description>\n`;
      if (job.salaryMin && job.salaryMax) {
        xml += `    <salary><![CDATA[$${job.salaryMin} - $${job.salaryMax} / year]]></salary>\n`;
      }
      xml += `    <jobtype><![CDATA[${job.employmentType}]]></jobtype>\n`;
      xml += `  </job>\n`;
    }
    
    xml += `</source>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('Error generating feed');
  }
});

// ── Admin: AI Job Generation ───────────────────────────────────────────────

/**
 * POST /api/v1/jobs/generate
 * Seeds jobs automatically. In a real scenario, this would use MCP/LLM.
 */
router.post('/generate', async (req: Request, res: Response): Promise<any> => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  // Simulate AI generation for growth hacking
  const job = await prisma.jobPosting.create({
    data: {
      title: `${keyword} (Confidential)`,
      description: `We are looking for a highly skilled ${keyword} to join an exclusive, confidential project managed via the Pabandi network. Apply now to unlock full details.`,
      location: 'Remote',
      employmentType: 'FREELANCE',
      salaryMin: 90000,
      salaryMax: 150000,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }
  });

  res.json({ success: true, data: job });
});

// ── Public ATS Endpoints ───────────────────────────────────────────────────

router.get('/:jobId', getJobDetails);
router.post('/:jobId/apply', authenticate, applyForJob);

export default router;
