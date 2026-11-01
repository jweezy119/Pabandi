import { OpenAI } from 'openai';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export interface JobRequirements {
  skills: string[];
  dateRange?: { start: Date; end: Date };
  budgetUsd?: number;
  venueType?: string;
  location?: string;
  complexity?: 'LOW' | 'MEDIUM' | 'HIGH';
  durationHours?: number;
}

export interface AgentMatchScore {
  agentId: string;
  agentPassportId: string;
  successProbability: number; // 0-100
  trustScore: number;
  historicalCompleted: number;
  availabilityScore: number;
  skillMatchScore: number;
  reasoning: string[];
}

export class AIPredictorService {
  /**
   * Parse a natural language job description into structured requirements.
   * Uses the LLM to extract skills, dates, budget, venue type, etc.
   */
  async parseJobDescription(text: string): Promise<JobRequirements> {
    try {
      const systemPrompt = `You are a job description parser for Pabandi's agent economy platform.
      Extract structured requirements from the following job description text.
      Return ONLY valid JSON matching this schema:
      {
        "skills": ["skill1", "skill2"],
        "dateRange": {"start": "ISO date", "end": "ISO date"} or null,
        "budgetUsd": number or null,
        "venueType": "string" or null,
        "location": "string" or null,
        "complexity": "LOW" | "MEDIUM" | "HIGH",
        "durationHours": number or null
      }`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0].message.content || '{}';
      const parsed = JSON.parse(raw);

      return {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        dateRange: parsed.dateRange
          ? { start: new Date(parsed.dateRange.start), end: new Date(parsed.dateRange.end) }
          : undefined,
        budgetUsd: parsed.budgetUsd || undefined,
        venueType: parsed.venueType || undefined,
        location: parsed.location || undefined,
        complexity: ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.complexity) ? parsed.complexity : 'MEDIUM',
        durationHours: parsed.durationHours || undefined,
      };
    } catch (error) {
      logger.error('[AIPredictor] parseJobDescription error:', error);
      // Fallback: heuristic extraction
      return this.parseJobDescriptionFallback(text);
    }
  }

  private parseJobDescriptionFallback(text: string): JobRequirements {
    const skills = [];
    const lower = text.toLowerCase();

    const skillKeywords = ['react', 'typescript', 'python', 'solidity', 'langchain', 'scrape', 'audit', 'design', 'write', 'inspect', 'verify'];
    for (const kw of skillKeywords) {
      if (lower.includes(kw)) skills.push(kw);
    }

    let budgetUsd: number | undefined;
    const budgetMatch = text.match(/\$([\d,]+)/);
    if (budgetMatch) budgetUsd = parseInt(budgetMatch[1].replace(/,/g, ''), 10);

    let complexity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (lower.includes('audit') || lower.includes('build') || lower.includes('complex')) complexity = 'HIGH';
    if (lower.includes('verify') || lower.includes('check') || lower.includes('simple')) complexity = 'LOW';

    return {
      skills,
      budgetUsd,
      complexity,
      location: undefined,
      dateRange: undefined,
      venueType: undefined,
      durationHours: undefined,
    };
  }

  /**
   * Predict the success probability (0-100) for an agent on a given job.
   * Combines Trust Score, historical completion rate, availability, and skill match.
   */
  predictSuccessProbability(
    agentPassport: { trustScore?: number; completedJobs?: number; successRate?: number; currentLoad?: number; skills?: string[] },
    jobRequirements: JobRequirements,
  ): AgentMatchScore {
    const trustScore = agentPassport.trustScore || 500;
    const normalizedTrust = Math.min(Math.max((trustScore - 300) / 700, 0), 1); // 0-1 scale

    const historicalCompleted = agentPassport.completedJobs || 0;
    const successRate = agentPassport.successRate ?? (historicalCompleted > 0 ? 85 : 50);

    const currentLoad = agentPassport.currentLoad ?? 0;
    const availabilityScore = Math.max(0, 1 - currentLoad / 5); // 0-1, lower load = higher availability

    const agentSkills = agentPassport.skills || [];
    const requiredSkills = jobRequirements.skills || [];
    const matchedSkills = requiredSkills.filter(s => agentSkills.some(as => as.toLowerCase() === s.toLowerCase()));
    const skillMatchScore = requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 0.5;

    // Weighted algorithm: Trust (40%), History (30%), Availability (15%), Skill Match (15%)
    const successProbability =
      normalizedTrust * 0.4 * 100 +
      (successRate / 100) * 0.3 * 100 +
      availabilityScore * 0.15 * 100 +
      skillMatchScore * 0.15 * 100;

    const reasoning: string[] = [];
    reasoning.push(`Trust Score: ${trustScore} (normalized: ${Math.round(normalizedTrust * 100)}%)`);
    reasoning.push(`Historical Success: ${successRate}% (${historicalCompleted} completed jobs)`);
    reasoning.push(`Availability: ${Math.round(availabilityScore * 100)}% (load: ${currentLoad}/5)`);
    reasoning.push(`Skill Match: ${Math.round(skillMatchScore * 100)}% (${matchedSkills.length}/${requiredSkills.length})`);

    return {
      agentId: (agentPassport as any).id || 'unknown',
      agentPassportId: (agentPassport as any).passportId || 'unknown',
      successProbability: Math.round(Math.min(100, Math.max(0, successProbability))),
      trustScore,
      historicalCompleted,
      availabilityScore: Math.round(availabilityScore * 100),
      skillMatchScore: Math.round(skillMatchScore * 100),
      reasoning,
    };
  }

  /**
   * Rank multiple agents for a job by success probability.
   */
  rankAgents(
    agents: Array<{ trustScore?: number; completedJobs?: number; successRate?: number; currentLoad?: number; skills?: string[] }>,
    jobRequirements: JobRequirements,
  ): AgentMatchScore[] {
    return agents
      .map(a => this.predictSuccessProbability(a, jobRequirements))
      .sort((a, b) => b.successProbability - a.successProbability);
  }
}

export const aiPredictor = new AIPredictorService();
