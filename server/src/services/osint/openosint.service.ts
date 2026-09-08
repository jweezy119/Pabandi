import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OsintFinding {
  source: string;
  label: string;
  value: string;
  confidence: 'high' | 'medium' | 'low';
  category: 'identity' | 'infrastructure' | 'breach' | 'image' | 'network' | 'document';
  provenance: string;
  isContradiction?: boolean;
  contradicts?: string;
}

export interface OsintReport {
  target: string;
  targetType: 'username' | 'email' | 'phone' | 'domain' | 'ip' | 'image' | 'business';
  generatedAt: string;
  summary: {
    riskScore: number;
    suspiciousCount: number;
    cleanCount: number;
    contradictionCount: number;
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
  };
  findings: OsintFinding[];
  contradictions: OsintContradiction[];
  attribution: {
    observedActions: string[];
    infrastructure: string[];
    selfIdentifiedClaims: string[];
    independentCorroboration: string[];
    attributionConfidence: 'unattributed' | 'possible' | 'likely' | 'confirmed';
  };
}

export interface OsintContradiction {
  id: string;
  type: 'temporal' | 'structural' | 'semantic' | 'identity';
  description: string;
  findingsInvolved: string[];
  severity: 'info' | 'warning' | 'critical';
  interpretation: string;
}

// ── Free API helpers ──────────────────────────────────────────────────────────
const FREE_APIS = {
  // No key required
  githubSearch: async (query: string) => {
    try {
      const resp = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Pabandi-OSINT' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.items || []).map((u: any) => ({ login: u.login, url: u.html_url, type: 'github' }));
    } catch { return []; }
  },

  // Free tier: 50k req/month, no key for basic
  ipInfo: async (ip: string) => {
    try {
      const resp = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },

  // Shodan free tier (requires SHODAN_API_KEY)
  shodanHost: async (ip: string, apiKey?: string) => {
    if (!apiKey) return null;
    try {
      const resp = await fetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${apiKey}`, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },

  // VirusTotal free tier (requires VT_API_KEY)
  virusTotal: async (target: string, apiKey?: string) => {
    if (!apiKey) return null;
    try {
      const encoded = encodeURIComponent(target);
      const resp = await fetch(`https://www.virustotal.com/api/v3/search?query=${encoded}`, {
        headers: { 'x-apikey': apiKey || '' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.data || null;
    } catch { return null; }
  },

  // Censys free tier (requires CENSYS_API_ID + CENSYS_API_SECRET)
  censysSearch: async (query: string, apiId?: string, apiSecret?: string) => {
    if (!apiId || !apiSecret) return null;
    try {
      const resp = await fetch('https://search.censys.io/api/v2/hosts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${apiId}:${apiSecret}`) },
        body: JSON.stringify({ q: query }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },

  // WhoisXML free tier (requires WHOISXML_API_KEY)
  whoisXml: async (domain: string, apiKey?: string) => {
    if (!apiKey) return null;
    try {
      const resp = await fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${encodeURIComponent(domain)}&outputFormat=JSON`, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },

  // HaveIBeenPwned free tier (requires HIBP_API_KEY)
  hibp: async (email: string, apiKey?: string) => {
    if (!apiKey) return null;
    try {
      const resp = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
        headers: { 'hibp-api-key': apiKey, 'User-Agent': 'Pabandi-OSINT' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.status === 404) return [];
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },

  // BreachDirectory (free, no key)
  breachDirectory: async (email: string) => {
    try {
      const resp = await fetch(`https://breachdirectory.org/apis?func=quick&term=${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },
};

// ── Tool functions ─────────────────────────────────────────────────────────────
export async function toolGitHubSearch(query: string): Promise<OsintFinding[]> {
  const results: OsintFinding[] = [];
  const users = await FREE_APIS.githubSearch(query);
  for (const u of users.slice(0, 10)) {
    results.push({
      source: 'github',
      label: 'GitHub user',
      value: u.url,
      confidence: 'high',
      category: 'identity',
      provenance: `https://api.github.com/search/users?q=${encodeURIComponent(query)}`,
    });
  }
  return results;
}

export async function toolPhoneIntelligence(phone: string): Promise<OsintFinding[]> {
  const results: OsintFinding[] = [];
  const normalized = phone.replace(/\s/g, '');
  const isVoip = /^(?!(\+?1|0)?(234|720|425|985)).*$/.test(normalized) && /\d{4,}$/.test(normalized);
  if (isVoip) {
    results.push({
      source: 'phone-analysis',
      label: 'Potential VOIP/temp number',
      value: phone,
      confidence: 'medium',
      category: 'identity',
      provenance: 'heuristic: number pattern analysis',
    });
  }
  results.push({
    source: 'phone-analysis',
    label: 'Phone normalized',
    value: normalized,
    confidence: 'high',
    category: 'identity',
    provenance: 'internal normalization',
  });
  return results;
}

export async function toolDomainIntel(domain: string): Promise<OsintFinding[]> {
  const results: OsintFinding[] = [];
  const whoisData = await FREE_APIS.whoisXml(domain, process.env.WHOISXML_API_KEY);
  if (whoisData?.WhoisRecord) {
    const rec = whoisData.WhoisRecord;
    const created = rec.createdDate ? new Date(rec.createdDate) : null;
    const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86400000) : null;
    results.push({
      source: 'whois',
      label: 'Domain age',
      value: ageDays !== null ? `${ageDays} days` : 'unknown',
      confidence: ageDays !== null ? 'high' : 'low',
      category: 'infrastructure',
      provenance: 'whoisxmlapi.com',
    });
    results.push({
      source: 'whois',
      label: 'Registrar',
      value: rec.registrarName || 'unknown',
      confidence: 'high',
      category: 'infrastructure',
      provenance: 'whoisxmlapi.com',
    });
    if (ageDays !== null && ageDays < 30) {
      results.push({
        source: 'whois-risk',
        label: 'Young domain flag',
        value: `${ageDays} days old`,
        confidence: 'high',
        category: 'infrastructure',
        provenance: 'whoisxmlapi.com age heuristic',
      });
    }
  }
  const vtData = await FREE_APIS.virusTotal(domain, process.env.VT_API_KEY);
  if (vtData && Array.isArray(vtData)) {
    const malicious = vtData.filter((d: any) => d.attributes?.last_analysis_stats?.malicious > 0).length;
    results.push({
      source: 'virustotal',
      label: 'Malicious detections',
      value: `${malicious}/${vtData.length}`,
      confidence: 'high',
      category: 'infrastructure',
      provenance: 'virustotal.com',
    });
  }
  const shodanData = await FREE_APIS.censysSearch(domain, process.env.CENSYS_API_ID, process.env.CENSYS_API_SECRET);
  if (shodanData?.result?.hits?.length) {
    results.push({
      source: 'censys',
      label: 'Censys hits',
      value: `${shodanData.result.hits.length} services found`,
      confidence: 'high',
      category: 'infrastructure',
      provenance: 'search.censys.io',
    });
  }
  return results;
}

export async function toolReverseImage(imageUrl: string): Promise<OsintFinding[]> {
  const results: OsintFinding[] = [];
  const lower = imageUrl.toLowerCase();
  if (lower.includes('stock') || lower.includes('fake') || lower.includes('placeholder')) {
    results.push({
      source: 'image-analysis',
      label: 'Known stock/placeholder image',
      value: imageUrl,
      confidence: 'medium',
      category: 'image',
      provenance: 'heuristic URL pattern match',
    });
  }
  results.push({
    source: 'image-analysis',
    label: 'Image URL recorded',
    value: imageUrl,
    confidence: 'high',
    category: 'image',
    provenance: 'input',
  });
  return results;
}

export async function toolIpAnalysis(ip: string): Promise<OsintFinding[]> {
  const results: OsintFinding[] = [];
  const ipInfo = await FREE_APIS.ipInfo(ip);
  if (ipInfo) {
    results.push({
      source: 'ipinfo',
      label: 'IP country',
      value: ipInfo.country || 'unknown',
      confidence: 'high',
      category: 'network',
      provenance: 'ipinfo.io',
    });
    results.push({
      source: 'ipinfo',
      label: 'IP org/ASN',
      value: ipInfo.org || 'unknown',
      confidence: 'high',
      category: 'network',
      provenance: 'ipinfo.io',
    });
    if (ipInfo.org?.toLowerCase().includes('azure') || ipInfo.org?.toLowerCase().includes('aws') || ipInfo.org?.toLowerCase().includes('gcp')) {
      results.push({
        source: 'infrastructure',
        label: 'Cloud infrastructure',
        value: ipInfo.org,
        confidence: 'high',
        category: 'infrastructure',
        provenance: 'ipinfo.io org field',
      });
    }
  }
  const shodanData = await FREE_APIS.shodanHost(ip, process.env.SHODAN_API_KEY);
  if (shodanData && !shodanData.error) {
    results.push({
      source: 'shodan',
      label: 'Open ports',
      value: (shodanData.ports || []).join(', ') || 'none',
      confidence: 'high',
      category: 'network',
      provenance: 'api.shodan.io',
    });
    if (shodanData.vulns && Object.keys(shodanData.vulns).length > 0) {
      results.push({
        source: 'shodan',
        label: 'Known vulnerabilities',
        value: `${Object.keys(shodanData.vulns).length} CVEs`,
        confidence: 'high',
        category: 'network',
        provenance: 'api.shodan.io',
      });
    }
  }
  return results;
}

export async function toolBreachCheck(email: string): Promise<OsintFinding[]> {
  const results: OsintFinding[] = [];
  const hibp = await FREE_APIS.hibp(email, process.env.HIBP_API_KEY);
  if (hibp && Array.isArray(hibp)) {
    for (const b of hibp.slice(0, 5)) {
      results.push({
        source: 'haveibeenpwned',
        label: `Breach: ${b.Name}`,
        value: b.BreachDate || 'unknown date',
        confidence: 'high',
        category: 'breach',
        provenance: 'haveibeenpwned.com',
      });
    }
  }
  const breachDir = await FREE_APIS.breachDirectory(email);
  if (breachDir && breachDir.result) {
    results.push({
      source: 'breachdirectory',
      label: 'Breach directory result',
      value: JSON.stringify(breachDir.result).slice(0, 200),
      confidence: 'medium',
      category: 'breach',
      provenance: 'breachdirectory.org',
    });
  }
  return results;
}

// ── Contradiction detection ───────────────────────────────────────────────────
export function detectContradictions(findings: OsintFinding[]): OsintContradiction[] {
  const contradictions: OsintContradiction[] = [];
  const bySource = new Map<string, OsintFinding[]>();
  for (const f of findings) {
    const arr = bySource.get(f.source) || [];
    arr.push(f);
    bySource.set(f.source, arr);
  }

  // Temporal contradictions: domain age claims
  const domainFindings = findings.filter(f => f.label === 'Domain age' || f.label === 'Young domain flag');
  if (domainFindings.length >= 2) {
    const ages = domainFindings.map(f => f.value);
    if (ages.some(a => a.includes('unknown')) && ages.some(a => !a.includes('unknown'))) {
      contradictions.push({
        id: 'temporal-001',
        type: 'temporal',
        description: 'Domain age reported inconsistently across sources.',
        findingsInvolved: domainFindings.map(f => f.source + ':' + f.label),
        severity: 'warning',
        interpretation: 'Either WHOIS data is incomplete or the domain has inconsistent registration records. Worth investigating further.',
      });
    }
  }

  // Semantic contradictions: IP claims
  const ipFindings = findings.filter(f => f.category === 'network' || f.category === 'infrastructure');
  const cloudClaims = ipFindings.filter(f => f.label === 'Cloud infrastructure');
  const orgClaims = ipFindings.filter(f => f.label === 'IP org/ASN');
  if (cloudClaims.length > 0 && orgClaims.length > 0) {
    const cloudOrgs = cloudClaims.map(f => f.value.toLowerCase());
    const hasConflict = orgClaims.some(f => !cloudOrgs.some(co => f.value.toLowerCase().includes(co.replace('cloud infrastructure: ', '').replace(' infrastructure', ''))));
    if (hasConflict) {
      contradictions.push({
        id: 'semantic-001',
        type: 'semantic',
        description: 'IP infrastructure classification conflicts between sources.',
        findingsInvolved: [...cloudClaims.map(f => f.source + ':' + f.label), ...orgClaims.map(f => f.source + ':' + f.label)],
        severity: 'info',
        interpretation: 'Different tools classify the same IP differently. This is common and not necessarily suspicious, but should be noted.',
      });
    }
  }

  // Identity contradictions
  const identityFindings = findings.filter(f => f.category === 'identity');
  const suspiciousIdentity = identityFindings.filter(f => f.value.toLowerCase().includes('voip') || f.value.toLowerCase().includes('temp'));
  if (suspiciousIdentity.length > 0 && identityFindings.length > 2) {
    contradictions.push({
      id: 'identity-001',
      type: 'identity',
      description: 'Mixed identity signals: some indicators suggest temporary/VOIP identity while others suggest established accounts.',
      findingsInvolved: suspiciousIdentity.map(f => f.source + ':' + f.label),
      severity: 'warning',
      interpretation: 'A user with both VOIP numbers and established social profiles is not automatically suspicious, but the combination warrants a closer look.',
    });
  }

  return contradictions;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
function scoreFinding(f: OsintFinding): number {
  if (f.isContradiction) return 10;
  switch (f.confidence) {
    case 'high': return f.source.includes('risk') || f.source.includes('pwned') || f.source.includes('breach') ? 15 : 5;
    case 'medium': return 8;
    case 'low': return 3;
    default: return 2;
  }
}

export function computeOsintRisk(findings: OsintFinding[], contradictions: OsintContradiction[]): OsintReport['summary'] {
  const suspiciousCount = findings.filter(f => f.source.includes('risk') || f.source.includes('breach') || f.source.includes('pwned') || f.isContradiction).length;
  const cleanCount = findings.filter(f => !f.isContradiction && !f.source.includes('risk') && !f.source.includes('breach') && !f.source.includes('pwned')).length;
  const contradictionCount = contradictions.length;
  const rawScore = findings.reduce((sum, f) => sum + scoreFinding(f), 0) + contradictions.reduce((sum, c) => sum + (c.severity === 'critical' ? 20 : c.severity === 'warning' ? 10 : 3), 0);
  const riskScore = Math.min(100, Math.max(0, rawScore));
  let overallRisk: OsintReport['summary']['overallRisk'] = 'low';
  if (riskScore > 75) overallRisk = 'critical';
  else if (riskScore > 50) overallRisk = 'high';
  else if (riskScore > 25) overallRisk = 'medium';
  return { riskScore, suspiciousCount, cleanCount, contradictionCount, overallRisk };
}

// ── Main investigation runner ─────────────────────────────────────────────────
export async function runInvestigation(target: string, targetType: OsintReport['targetType']): Promise<OsintReport> {
  logger.info(`[OpenOSINT] Starting investigation: ${targetType} => ${target}`);
  const findings: OsintFinding[] = [];

  try {
    switch (targetType) {
      case 'username': {
        const gh = await toolGitHubSearch(target);
        findings.push(...gh);
        break;
      }
      case 'phone': {
        const phone = await toolPhoneIntelligence(target);
        findings.push(...phone);
        break;
      }
      case 'domain': {
        const domain = await toolDomainIntel(target);
        findings.push(...domain);
        break;
      }
      case 'ip': {
        const ip = await toolIpAnalysis(target);
        findings.push(...ip);
        break;
      }
      case 'image': {
        const img = await toolReverseImage(target);
        findings.push(...img);
        break;
      }
      case 'email': {
        const breaches = await toolBreachCheck(target);
        findings.push(...breaches);
        const username = target.split('@')[0];
        const gh = await toolGitHubSearch(username);
        findings.push(...gh);
        break;
      }
      case 'business': {
        const domain = target.replace(/^(https?:\/\/)/, '').replace(/\/.*$/, '');
        const domainIntel = await toolDomainIntel(domain);
        findings.push(...domainIntel);
        break;
      }
    }
  } catch (e) {
    logger.error('[OpenOSINT] Investigation error', e);
  }

  const contradictions = detectContradictions(findings);
  const summary = computeOsintRisk(findings, contradictions);

  const report: OsintReport = {
    target,
    targetType,
    generatedAt: new Date().toISOString(),
    summary,
    findings,
    contradictions,
    attribution: buildAttribution(findings, contradictions),
  };

  logger.info(`[OpenOSINT] Investigation complete: ${findings.length} findings, ${contradictions.length} contradictions, risk=${summary.overallRisk}`);
  return report;
}

export function buildAttribution(findings: OsintFinding[], contradictions: OsintContradiction[]): OsintReport['attribution'] {
  const observedActions: string[] = [];
  const infrastructure: string[] = [];
  const selfIdentifiedClaims: string[] = [];
  const independentCorroboration: string[] = [];

  for (const f of findings) {
    if (f.category === 'network' || f.category === 'infrastructure') infrastructure.push(`${f.source}:${f.label}`);
    else if (f.category === 'identity') observedActions.push(`${f.source}:${f.label}`);
    else independentCorroboration.push(`${f.source}:${f.label}`);
  }

  let attributionConfidence: OsintReport['attribution']['attributionConfidence'] = 'unattributed';
  if (independentCorroboration.length >= 3 && infrastructure.length >= 2) attributionConfidence = 'likely';
  else if (independentCorroboration.length >= 2 || infrastructure.length >= 2) attributionConfidence = 'possible';

  return { observedActions, infrastructure, selfIdentifiedClaims, independentCorroboration, attributionConfidence };
}

// ── MCP tool definitions ──────────────────────────────────────────────────────
export const OPENOSINT_TOOLS = [
  {
    name: 'openosint_investigate',
    description: 'Run a full OpenOSINT investigation on a target (username, email, phone, domain, IP, image, or business). Returns structured findings with contradiction detection and attribution confidence.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'The target to investigate' },
        targetType: { type: 'string', description: 'One of: username, email, phone, domain, ip, image, business' },
      },
      required: ['target', 'targetType'],
    },
  },
  {
    name: 'openosint_username_search',
    description: 'Search for a username across GitHub and other platforms.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username to search' },
      },
      required: ['username'],
    },
  },
  {
    name: 'openosint_phone_intel',
    description: 'Analyze a phone number for VOIP/temp indicators and normalization.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone number to analyze' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'openosint_domain_intel',
    description: 'Run WHOIS, VirusTotal, and Censys checks on a domain.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Domain to investigate' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'openosint_ip_analysis',
    description: 'Analyze an IP address: geolocation, ASN, Shodan ports/vulns, cloud provider detection.',
    inputSchema: {
      type: 'object',
      properties: {
        ip: { type: 'string', description: 'IP address to analyze' },
      },
      required: ['ip'],
    },
  },
  {
    name: 'openosint_breach_check',
    description: 'Check if an email appears in known breaches (HIBP + BreachDirectory).',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email to check' },
      },
      required: ['email'],
    },
  },
  {
    name: 'openosint_contradiction_detect',
    description: 'Analyze a set of OSINT findings for contradictions (temporal, structural, semantic, identity). Returns IoI-style indicators.',
    inputSchema: {
      type: 'object',
      properties: {
        findings: { type: 'array', description: 'Array of OsintFinding objects to analyze' },
      },
      required: ['findings'],
    },
  },
  {
    name: 'openosint_attribution_assess',
    description: 'Assess attribution confidence from investigation findings. Returns infrastructure mapping, observed actions, and attribution confidence level.',
    inputSchema: {
      type: 'object',
      properties: {
        findings: { type: 'array', description: 'Array of OsintFinding objects' },
      },
      required: ['findings'],
    },
  },
];
