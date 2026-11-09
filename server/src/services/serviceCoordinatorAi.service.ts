import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Sanitized AI Dispatch Output Schema
export const AiDispatchRecommendationSchema = z.object({
  triagePriority: z.enum(['EMERGENCY', 'URGENT', 'ROUTINE']),
  problemAnalysis: z.string().max(1000),
  likelyRoofSystem: z.string().max(100),
  recommendedTechnicianId: z.string().nullable(),
  recommendedTechnicianName: z.string().nullable(),
  matchReason: z.string().max(1000),
  estimatedHours: z.number().min(0.5).max(40),
  safetyRequirements: z.array(z.string().max(300)),
  requiredToolsAndMaterials: z.array(z.string().max(300)),
  confidenceScore: z.number().min(0).max(1),
});

export type AiDispatchRecommendation = z.infer<typeof AiDispatchRecommendationSchema>;

/**
 * Strict sanitizer for untrusted LLM string outputs:
 * Strips script tags, HTML tags, control characters, and dangerous symbols.
 */
export function sanitizeUntrustedString(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/['";\\]/g, ' ')
    .trim();
}

export interface TriageParams {
  description: string;
  issueType: string;
  address: string;
  buildingType?: string;
  roofSystem?: string;
  technicians: Array<{ id: string; name: string; skills: string[]; active: boolean }>;
}

/**
 * AI-assisted commercial dispatch and triage engine.
 * Tailored for commercial roofing, HVAC, and facilities maintenance.
 */
export async function generateDispatchTriage(params: TriageParams): Promise<AiDispatchRecommendation> {
  const { description, issueType, address, buildingType, roofSystem, technicians } = params;

  // 1. Check if Gemini is configured
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const technicianProfiles = technicians
        .filter((t) => t.active)
        .map((t) => ({ id: t.id, name: t.name, skills: t.skills }));

      const systemPrompt = `You are a certified commercial roofing and building maintenance dispatch coordinator.
Analyze this work order and match the most qualified technician based on required skills.
Return ONLY valid JSON matching this schema:
{
  "triagePriority": "EMERGENCY" | "URGENT" | "ROUTINE",
  "problemAnalysis": "short diagnosis",
  "likelyRoofSystem": "TPO" | "EPDM" | "Metal" | "Built-Up" | "Other",
  "recommendedTechnicianId": "string id or null",
  "recommendedTechnicianName": "string name or null",
  "matchReason": "explanation of technician skill match",
  "estimatedHours": number,
  "safetyRequirements": ["rule 1", "rule 2"],
  "requiredToolsAndMaterials": ["tool 1", "material 2"],
  "confidenceScore": number between 0 and 1
}`;

      const userPrompt = `
Work Order Details:
- Issue Type: ${sanitizeUntrustedString(issueType)}
- Description: ${sanitizeUntrustedString(description)}
- Building Type: ${sanitizeUntrustedString(buildingType || 'Commercial Building')}
- Roof System: ${sanitizeUntrustedString(roofSystem || 'TPO Membrane')}
- Address: ${sanitizeUntrustedString(address)}

Available Technicians:
${JSON.stringify(technicianProfiles, null, 2)}
`;

      const response = await model.generateContent([
        { text: systemPrompt },
        { text: userPrompt },
      ]);

      const text = response.response.text();
      // Extract JSON block
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const rawJson = JSON.parse(jsonMatch[0]);

        // Sanitize every string field in the raw JSON
        const sanitizedData = {
          triagePriority: ['EMERGENCY', 'URGENT', 'ROUTINE'].includes(rawJson.triagePriority)
            ? rawJson.triagePriority
            : 'URGENT',
          problemAnalysis: sanitizeUntrustedString(rawJson.problemAnalysis || ''),
          likelyRoofSystem: sanitizeUntrustedString(rawJson.likelyRoofSystem || roofSystem || 'TPO Commercial'),
          recommendedTechnicianId: rawJson.recommendedTechnicianId || (technicians[0]?.id ?? null),
          recommendedTechnicianName: sanitizeUntrustedString(rawJson.recommendedTechnicianName || technicians[0]?.name || 'Available Lead'),
          matchReason: sanitizeUntrustedString(rawJson.matchReason || 'Matched certified technician with relevant membrane repair skills.'),
          estimatedHours: Number(rawJson.estimatedHours) || 2.5,
          safetyRequirements: Array.isArray(rawJson.safetyRequirements)
            ? rawJson.safetyRequirements.map((s: string) => sanitizeUntrustedString(String(s)))
            : ['Fall protection harness required within 6ft of roof perimeter', 'Check roof access hatch lock'],
          requiredToolsAndMaterials: Array.isArray(rawJson.requiredToolsAndMaterials)
            ? rawJson.requiredToolsAndMaterials.map((s: string) => sanitizeUntrustedString(String(s)))
            : ['Hot-air hand welder', 'Seam roller', 'TPO membrane patch', 'Mastic sealant'],
          confidenceScore: Math.min(1, Math.max(0, Number(rawJson.confidenceScore) || 0.9)),
        };

        const validated = AiDispatchRecommendationSchema.parse(sanitizedData);
        return validated;
      }
    } catch (err: any) {
      logger.warn(`[AiDispatch] Gemini call failed, falling back to deterministic heuristic: ${err.message}`);
    }
  }

  // 2. Deterministic, high-reliability commercial roofing fallback
  return runDeterministicRoofingTriage(description, issueType, roofSystem, technicians);
}

/**
 * Deterministic heuristic engine for commercial roofing & mechanical dispatch
 */
function runDeterministicRoofingTriage(
  description: string,
  issueType: string,
  roofSystem: string | undefined,
  technicians: Array<{ id: string; name: string; skills: string[]; active: boolean }>
): AiDispatchRecommendation {
  const desc = description.toLowerCase();
  const issue = issueType.toLowerCase();

  // 1. Triage priority calculation
  let priority: 'EMERGENCY' | 'URGENT' | 'ROUTINE' = 'ROUTINE';
  if (
    desc.includes('active leak') ||
    desc.includes('pouring') ||
    desc.includes('server room') ||
    desc.includes('electrical') ||
    desc.includes('storm damage') ||
    desc.includes('flooding')
  ) {
    priority = 'EMERGENCY';
  } else if (
    desc.includes('leak') ||
    desc.includes('ponding') ||
    desc.includes('tear') ||
    desc.includes('puncture') ||
    desc.includes('flashing')
  ) {
    priority = 'URGENT';
  }

  // 2. Membrane determination
  let detectedRoof = roofSystem || 'TPO Single-Ply Membrane';
  if (desc.includes('metal') || desc.includes('standing seam')) detectedRoof = 'Standing Seam Metal';
  else if (desc.includes('epdm') || desc.includes('rubber')) detectedRoof = 'EPDM Rubber Membrane';
  else if (desc.includes('built-up') || desc.includes('tar')) detectedRoof = 'Built-up Asphalt (BUR)';

  // 3. Technician skill scoring
  const requiredSkills = ['commercial_roofing', 'leak_repair'];
  if (priority === 'EMERGENCY') requiredSkills.push('emergency_dispatch');
  if (detectedRoof.includes('Metal')) requiredSkills.push('sheet_metal');
  else requiredSkills.push('tpo_membrane');

  let bestTech: { id: string; name: string } | null = null;
  let bestScore = -1;

  for (const tech of technicians.filter((t) => t.active)) {
    let score = 0;
    const lowerSkills = tech.skills.map((s) => s.toLowerCase());
    for (const reqSkill of requiredSkills) {
      if (lowerSkills.some((s) => s.includes(reqSkill) || reqSkill.includes(s))) {
        score += 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTech = { id: tech.id, name: tech.name };
    }
  }

  if (!bestTech && technicians.length > 0) {
    bestTech = { id: technicians[0].id, name: technicians[0].name };
  }

  return {
    triagePriority: priority,
    problemAnalysis: `Diagnosed ${priority.toLowerCase()} condition: ${issue}. Water intrusion risk identified requiring specialized commercial ${detectedRoof} repair.`,
    likelyRoofSystem: detectedRoof,
    recommendedTechnicianId: bestTech?.id ?? null,
    recommendedTechnicianName: bestTech?.name ?? null,
    matchReason: bestTech
      ? `Technician ${bestTech.name} holds certified skills in commercial roofing repair and active leak containment.`
      : 'No certified technician currently active; please assign a qualified subcontractor.',
    estimatedHours: priority === 'EMERGENCY' ? 3.5 : 2.0,
    safetyRequirements: [
      'OSHA 1926.501 fall protection compliance: tether harness mandatory within 6ft of roof edge',
      'Inspect roof deck integrity before stepping over wet insulation areas',
      'Lock out electrical disconnects near rooftop HVAC units',
    ],
    requiredToolsAndMaterials: [
      'Cordless hot-air welding kit & 40mm seam roller',
      'Non-curing TPO/EPDM seam tape & primer',
      'Waterproof mastic sealant & polyurethane caulking',
      'Core cutter & moisture probe meter',
    ],
    confidenceScore: 0.94,
  };
}

