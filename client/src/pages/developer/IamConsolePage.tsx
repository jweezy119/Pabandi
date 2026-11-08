import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { getAuthToken } from '../../utils/authToken';

interface OAuthApp {
  id: string;
  clientId: string;
  clientSecret?: string;
  name: string;
  redirectUris: string[];
  createdAt: string;
}

interface VerificationCheckItem {
  id: string;
  title: string;
  verified: boolean;
  boost: string;
}

const NAV_ITEMS = [
  { path: '/developer/iam', label: 'IAM & OIDC Console', icon: 'key', end: true },
  { path: '/developer', label: 'Developer Portal', icon: 'terminal' },
  { path: '/agents', label: 'Web3 Agents', icon: 'smart_toy' },
  { path: '/simulator', label: 'Deal Simulator', icon: 'model_training' },
  { path: '/booking', label: 'BookingOS', icon: 'event' },
];

export default function IamConsolePage() {
  const [activeTab, setActiveTab] = useState<'apps' | 'agents' | 'verifications' | 'snippets'>('apps');
  const [snippetLanguage, setSnippetLanguage] = useState<'nextauth' | 'python' | 'express' | 'curl'>('nextauth');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // App Creation Form
  const [appName, setAppName] = useState('');
  const [redirectUriInput, setRedirectUriInput] = useState('http://localhost:3000/api/auth/callback');
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [newlyCreatedApp, setNewlyCreatedApp] = useState<OAuthApp | null>(null);
  const [loadingApps, setLoadingApps] = useState(false);

  // Verification Hub
  const [trustScore, setTrustScore] = useState(85);
  const [trustBand, setTrustBand] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('B');
  const [checklist, setChecklist] = useState<VerificationCheckItem[]>([
    { id: 'email', title: 'Email Address Verified', verified: true, boost: '+10 Trust' },
    { id: 'phone', title: 'Phone Number (SMS OTP)', verified: false, boost: '+10 Trust' },
    { id: 'github', title: 'GitHub Open-Source Profile Linked', verified: true, boost: '+15 Trust' },
    { id: 'solana', title: 'Solana Web3 Wallet Signed', verified: true, boost: '+15 Trust' },
    { id: 'business', title: 'OpenStreetMap Physical Business Claimed', verified: false, boost: '+20 Trust' },
    { id: 'escrow', title: 'First Escrow Milestone Settled', verified: true, boost: '+25 Trust' },
  ]);

  // Agent Leases
  const [agentId, setAgentId] = useState('agent_alpha_autonomous');
  const [spendLimit, setSpendLimit] = useState(250);
  const [leaseDuration, setLeaseDuration] = useState('15m');
  const [generatedLeaseToken, setGeneratedLeaseToken] = useState<string | null>(null);

  useEffect(() => {
    fetchApps();
    fetchVerifications();
  }, []);

  const fetchApps = async () => {
    setLoadingApps(true);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/oauth/apps`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data) setApps(json.data);
      }
    } catch (e) {
      console.warn('Apps optional fetch:', e);
    } finally {
      setLoadingApps(false);
    }
  };

  const fetchVerifications = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/oauth/verifications`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setTrustScore(json.data.trustScore || 85);
          setTrustBand(json.data.trustBand || 'B');
          if (json.data.checklist) setChecklist(json.data.checklist);
        }
      }
    } catch (e) {
      console.warn('Verifications fetch note:', e);
    }
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    try {
      const token = getAuthToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/oauth/apps`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: appName.trim(),
            redirectUris: [redirectUriInput.trim()],
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setNewlyCreatedApp(json.data);
          setApps((prev) => [json.data, ...prev]);
          setAppName('');
        }
      }
    } catch (err) {
      console.error('Failed to create app:', err);
    }
  };

  const handleGenerateAgentLease = () => {
    // Generate sample ephemeral capability lease token
    const sampleToken = `pab_lease_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    setGeneratedLeaseToken(sampleToken);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const codeSnippets = {
    nextauth: `// pages/api/auth/[...nextauth].ts or auth.ts
import NextAuth from "next-auth";

export default NextAuth({
  providers: [
    {
      id: "pabandi",
      name: "Pabandi Trust IAM",
      type: "oauth",
      wellKnown: "https://pabandi.com/.well-known/openid-configuration",
      authorization: { params: { scope: "openid profile email trust:passport" } },
      clientId: process.env.PABANDI_CLIENT_ID,
      clientSecret: process.env.PABANDI_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          trustScore: profile.trust_score,
          trustBand: profile.trust_band, // e.g. "A" | "B" | "C"
          principalType: profile.principal_type, // "human" | "agent"
        };
      },
    },
  ],
});`,
    python: `# agent_client.py - Machine-to-Machine (M2M) with DPoP (RFC 9449)
import requests
import time
import base64

# 1. Obtain Ephemeral M2M Capability Lease Token (15-min lease)
token_res = requests.post(
    "https://api.pabandi.com/api/v1/oauth/token",
    json={
        "grant_type": "client_credentials",
        "client_id": "pab_app_YOUR_CLIENT_ID",
        "client_secret": "pab_sec_YOUR_CLIENT_SECRET"
    },
    headers={"DPoP": "YOUR_SIGNED_DPOP_PROOF_JWT"} # Optional RFC 9449 binding
).json()

access_token = token_res["access_token"]
trust_band = token_res.get("trust_band") # e.g. "B"

# 2. Invoke Protected Action with Trust Band Enforcement
res = requests.post(
    "https://api.pabandi.com/api/v1/engine/action",
    headers={"Authorization": f"Bearer {access_token}"},
    json={"actionType": "booking", "amountCents": 5000}
)
print("Execution Result:", res.json())`,
    express: `// server.js - Protect APIs with requireTrustBand
import express from 'express';
import { requireTrustBand } from './middleware/requireTrustBand';

const app = express();
app.use(express.json());

// Only allow Trust Band B or higher. Band C/D requires Human-In-The-Loop approval over $100.
app.post('/api/ai/execute-milestone', requireTrustBand('B'), async (req, res) => {
  const { trust_score, trust_band, principal_type } = req.iamAuth;
  
  res.json({
    success: true,
    message: \`Authorized for \${principal_type} with Trust Band \${trust_band} (Score: \${trust_score})\`,
  });
});

app.listen(4000);`,
    curl: `# 1. M2M Agent Token Exchange (Client Credentials)
curl -X POST https://api.pabandi.com/api/v1/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "pab_app_YOUR_CLIENT_ID",
    "client_secret": "pab_sec_YOUR_CLIENT_SECRET"
  }'

# 2. Sign-In with Solana (SIWS)
curl -X POST https://api.pabandi.com/api/v1/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "siws",
    "walletAddress": "7nxw8z...",
    "signature": "3yZ8...",
    "message": "Sign in to Pabandi IAM"
  }'

# 3. Token Introspection (RFC 7662)
curl -X POST https://api.pabandi.com/api/v1/oauth/introspect \\
  -H "Content-Type: application/json" \\
  -d '{"token": "YOUR_ACCESS_TOKEN"}'`,
  };

  return (
    <DashboardLayout osName="DeveloperOS" osIcon="◈" osColor="terracotta" navItems={NAV_ITEMS}>
      <div className="space-y-8 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ background: 'var(--warm-sand)', color: 'var(--clay)' }}
              >
                Open-Source Auth0 Alternative
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'var(--sage)', color: 'white' }}
              >
                OIDC + DPoP + SIWS
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--warm-ink)' }}>
              Pabandi Trust IAM Console
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--soft-stone)' }}>
              Unified Identity & Access Management for humans and autonomous AI agents. Embed verifiable trust scores, non-custodial capability leases, and DPoP cryptographic bindings directly into standard JWTs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://pabandi.com/.well-known/openid-configuration"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              style={{
                background: 'var(--warm-sand)',
                border: '1px solid rgba(191,179,163,0.35)',
                color: 'var(--warm-ink)',
              }}
            >
              <span className="material-symbols-outlined text-[16px]">integration_instructions</span>
              OIDC Discovery ↗
            </a>
            <a
              href="https://pabandi.com/.well-known/jwks.json"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              style={{
                background: 'var(--warm-sand)',
                border: '1px solid rgba(191,179,163,0.35)',
                color: 'var(--warm-ink)',
              }}
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              JWKS Public Keys ↗
            </a>
          </div>
        </div>

        {/* Global Identity & Trust Meter */}
        <ClayCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-wider" style={{ color: 'var(--soft-stone)' }}>
                Your Principal Trust Identity
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-extrabold" style={{ color: 'var(--warm-ink)' }}>
                  {trustScore}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--soft-stone)' }}>
                  / 100 Trust Score
                </span>
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold"
                  style={{
                    background: trustBand === 'A' ? 'var(--sage)' : 'var(--clay)',
                    color: 'white',
                  }}
                >
                  Trust Band {trustBand}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                {trustBand === 'A'
                  ? 'Tier 1 Prime: Autonomous zero-escrow execution, instant booking settlement.'
                  : trustBand === 'B'
                  ? 'Tier 2 Verified: Low-friction 10% escrow deposit, high rate limits.'
                  : 'Tier 3 Standard: Human-in-the-loop authorization required on transactions over $100.'}
              </p>
            </div>

            <div className="flex flex-col gap-1 sm:text-right">
              <span className="text-xs text-[var(--soft-stone)]">Issuer Authority</span>
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--warm-ink)' }}>
                did:web:pabandi.com
              </span>
              <span className="text-xs text-[var(--sage)] font-medium">✓ Cryptographically Signed (RS256)</span>
            </div>
          </div>
        </ClayCard>

        {/* Console Navigation Tabs */}
        <div className="flex gap-2 border-b border-[rgba(191,179,163,0.3)] pb-2 overflow-x-auto">
          {[
            { id: 'apps', label: 'OAuth Applications', icon: 'apps' },
            { id: 'agents', label: 'Agent Credentials & Leases', icon: 'smart_toy' },
            { id: 'verifications', label: 'Verification Hub', icon: 'verified' },
            { id: 'snippets', label: 'Code Generator', icon: 'code' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[var(--clay)] text-white shadow-sm'
                  : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: APPLICATIONS */}
        {activeTab === 'apps' && (
          <div className="space-y-6">
            <ClayCard className="p-6">
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--warm-ink)' }}>
                Register New OAuth / OIDC Application
              </h2>
              <p className="text-xs mb-4" style={{ color: 'var(--soft-stone)' }}>
                Create Client ID and Client Secret credentials for web apps, mobile clients, and enterprise SSO integrations.
              </p>

              <form onSubmit={handleCreateApp} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--warm-ink)' }}>
                    Application Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme AI Agent Fleet / Marketplace App"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
                    style={{
                      background: 'white',
                      borderColor: 'rgba(191,179,163,0.4)',
                      color: 'var(--warm-ink)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--warm-ink)' }}>
                    Allowed Callback / Redirect URI
                  </label>
                  <input
                    type="url"
                    placeholder="https://yourapp.com/api/auth/callback"
                    value={redirectUriInput}
                    onChange={(e) => setRedirectUriInput(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none font-mono"
                    style={{
                      background: 'white',
                      borderColor: 'rgba(191,179,163,0.4)',
                      color: 'var(--warm-ink)',
                    }}
                  />
                </div>

                <ClayButton variant="primary" type="submit" className="w-full sm:w-auto">
                  Generate Application Credentials
                </ClayButton>
              </form>

              {newlyCreatedApp && (
                <div
                  className="mt-6 p-4 rounded-2xl border"
                  style={{ background: 'rgba(235,244,240,0.7)', borderColor: 'var(--sage)' }}
                >
                  <div className="flex items-center gap-2 mb-2 font-bold text-sm" style={{ color: 'var(--sage)' }}>
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Application Successfully Registered!
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--warm-ink)' }}>
                    Save your Client Secret immediately. For security, it will not be shown again in plaintext.
                  </p>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 bg-white rounded-lg border border-[rgba(191,179,163,0.3)] flex justify-between items-center">
                      <span><strong>Client ID:</strong> {newlyCreatedApp.clientId}</span>
                      <button
                        onClick={() => copyToClipboard(newlyCreatedApp.clientId, 'new_id')}
                        className="text-xs text-[var(--clay)] font-sans font-semibold hover:underline"
                      >
                        {copiedKey === 'new_id' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {newlyCreatedApp.clientSecret && (
                      <div className="p-2.5 bg-white rounded-lg border border-[rgba(191,179,163,0.3)] flex justify-between items-center">
                        <span className="truncate mr-2"><strong>Client Secret:</strong> {newlyCreatedApp.clientSecret}</span>
                        <button
                          onClick={() => copyToClipboard(newlyCreatedApp.clientSecret || '', 'new_sec')}
                          className="text-xs text-[var(--clay)] font-sans font-semibold hover:underline shrink-0"
                        >
                          {copiedKey === 'new_sec' ? 'Copied!' : 'Copy Secret'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ClayCard>

            <ClayCard className="p-6">
              <h3 className="font-bold text-base mb-3" style={{ color: 'var(--warm-ink)' }}>
                Registered OAuth Applications
              </h3>
              {loadingApps ? (
                <p className="text-xs text-[var(--soft-stone)]">Loading registered applications...</p>
              ) : apps.length === 0 ? (
                <div
                  className="p-6 text-center rounded-2xl border border-dashed text-xs"
                  style={{ borderColor: 'rgba(191,179,163,0.4)', color: 'var(--soft-stone)' }}
                >
                  No custom applications created yet. Register your first application above to receive a Client ID and Secret.
                </div>
              ) : (
                <div className="space-y-3">
                  {apps.map((app) => (
                    <div
                      key={app.id || app.clientId}
                      className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{ background: 'var(--warm-sand)', borderColor: 'rgba(191,179,163,0.35)' }}
                    >
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: 'var(--warm-ink)' }}>
                          {app.name}
                        </h4>
                        <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--soft-stone)' }}>
                          {app.clientId}
                        </p>
                        <p className="text-[11px] text-[var(--soft-stone)] mt-1">
                          Redirects: {app.redirectUris?.join(', ') || 'None configured'}
                        </p>
                      </div>

                      <button
                        onClick={() => copyToClipboard(app.clientId, app.clientId)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white hover:bg-[var(--warm-sand)] transition-all self-start sm:self-center"
                        style={{ borderColor: 'rgba(191,179,163,0.4)', color: 'var(--warm-ink)' }}
                      >
                        {copiedKey === app.clientId ? 'Copied Client ID!' : 'Copy Client ID'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ClayCard>
          </div>
        )}

        {/* TAB 2: AGENT CREDENTIALS & LEASES */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            <ClayCard className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--clay)' }}>
                  smart_toy
                </span>
                <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>
                  Autonomous Agent Capability Leases (M2M)
                </h2>
              </div>
              <p className="text-xs mb-5" style={{ color: 'var(--soft-stone)' }}>
                Issue short-lived (max 15-minute) capability tokens to autonomous AI agents with bounded spend caps and DPoP key binding.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--warm-ink)' }}>
                    Agent Identifier
                  </label>
                  <input
                    type="text"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none font-mono"
                    style={{ background: 'white', borderColor: 'rgba(191,179,163,0.4)', color: 'var(--warm-ink)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--warm-ink)' }}>
                    Max Delegated Spend ($ USDC)
                  </label>
                  <input
                    type="number"
                    value={spendLimit}
                    onChange={(e) => setSpendLimit(Number(e.target.value))}
                    min={10}
                    max={5000}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
                    style={{ background: 'white', borderColor: 'rgba(191,179,163,0.4)', color: 'var(--warm-ink)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--warm-ink)' }}>
                    Lease Duration (Strict &lt;= 15 min)
                  </label>
                  <select
                    value={leaseDuration}
                    onChange={(e) => setLeaseDuration(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
                    style={{ background: 'white', borderColor: 'rgba(191,179,163,0.4)', color: 'var(--warm-ink)' }}
                  >
                    <option value="5m">5 Minutes (Ultra Short)</option>
                    <option value="10m">10 Minutes (Standard Task)</option>
                    <option value="15m">15 Minutes (Maximum Allowed)</option>
                  </select>
                </div>
              </div>

              <ClayButton variant="primary" onClick={handleGenerateAgentLease}>
                Issue Ephemeral Capability Lease
              </ClayButton>

              {generatedLeaseToken && (
                <div
                  className="mt-5 p-4 rounded-2xl border"
                  style={{ background: 'var(--warm-sand)', borderColor: 'rgba(191,179,163,0.4)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--clay)' }}>
                      Active Capability Lease Token (Expires in {leaseDuration})
                    </span>
                    <button
                      onClick={() => copyToClipboard(generatedLeaseToken, 'lease_token')}
                      className="text-xs font-semibold text-[var(--clay)] hover:underline"
                    >
                      {copiedKey === 'lease_token' ? 'Copied!' : 'Copy Token'}
                    </button>
                  </div>
                  <p className="font-mono text-xs break-all p-2.5 bg-white rounded-lg border border-[rgba(191,179,163,0.3)]">
                    {generatedLeaseToken}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[11px]" style={{ color: 'var(--soft-stone)' }}>
                    <span>Cap: ${spendLimit} USDC</span>
                    <span>•</span>
                    <span>Algorithm: RS256</span>
                    <span>•</span>
                    <span>Principal: Agent</span>
                    <span>•</span>
                    <span>DPoP Ready (jkt proof supported)</span>
                  </div>
                </div>
              )}
            </ClayCard>

            <ClayCard className="p-6">
              <h3 className="font-bold text-base mb-2" style={{ color: 'var(--warm-ink)' }}>
                Demonstrating DPoP (RFC 9449) Key Binding
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--soft-stone)' }}>
                Demonstration of how an autonomous agent signs an ephemeral proof header to cryptographically bind tokens to its key, making stolen tokens completely useless to adversaries.
              </p>
              <div
                className="p-4 rounded-xl border font-mono text-xs overflow-x-auto"
                style={{ background: 'rgba(28,25,23,0.03)', borderColor: 'rgba(191,179,163,0.35)' }}
              >
                <div className="text-[var(--clay)] font-bold mb-1">// DPoP Header Attached to Agent HTTP Requests:</div>
                <div>DPoP: eyJhbGciOiJSUzI1NiIsImp3ayI6eyJrdHkiOiJSU0EiLCJuIjoi...In0sInR5cCI6ImRwb3Arand0In0...</div>
                <div className="mt-2 text-[var(--soft-stone)]">// Pabandi IAM verifies: JWK Thumbprint (jkt) == token.cnf.jkt</div>
              </div>
            </ClayCard>
          </div>
        )}

        {/* TAB 3: VERIFICATION HUB */}
        {activeTab === 'verifications' && (
          <div className="space-y-6">
            <ClayCard className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>
                    Verification Hub: Boost Your Trust Score
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--soft-stone)' }}>
                    Unlike traditional identity providers, verification on Pabandi directly increases your Trust Band, lowering required escrow deposits and unlocking autonomous deals.
                  </p>
                </div>
                <div
                  className="px-4 py-2 rounded-xl text-center border shrink-0"
                  style={{ background: 'var(--warm-sand)', borderColor: 'rgba(191,179,163,0.4)' }}
                >
                  <div className="text-xs text-[var(--soft-stone)]">Current Band</div>
                  <div className="text-xl font-extrabold" style={{ color: 'var(--clay)' }}>
                    Band {trustBand} ({trustScore} pts)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border flex items-center justify-between gap-3"
                    style={{
                      background: item.verified ? 'rgba(235,244,240,0.6)' : 'white',
                      borderColor: item.verified ? 'var(--sage)' : 'rgba(191,179,163,0.35)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ color: item.verified ? 'var(--sage)' : 'var(--soft-stone)' }}
                      >
                        {item.verified ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>
                          {item.title}
                        </h4>
                        <span
                          className="inline-block text-[11px] font-bold mt-0.5"
                          style={{ color: item.verified ? 'var(--sage)' : 'var(--clay)' }}
                        >
                          {item.boost}
                        </span>
                      </div>
                    </div>

                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-semibold"
                      style={{
                        background: item.verified ? 'var(--sage)' : 'var(--warm-sand)',
                        color: item.verified ? 'white' : 'var(--warm-ink)',
                      }}
                    >
                      {item.verified ? 'Verified' : 'Verify Now'}
                    </span>
                  </div>
                ))}
              </div>
            </ClayCard>
          </div>
        )}

        {/* TAB 4: CODE SNIPPET GENERATOR */}
        {activeTab === 'snippets' && (
          <div className="space-y-6">
            <ClayCard className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>
                    Drop-In Integration Snippets
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                    Plug Pabandi Trust IAM into any web app, Python agent, or backend in seconds.
                  </p>
                </div>

                <div className="flex gap-1.5 p-1 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                  {[
                    { id: 'nextauth', label: 'NextAuth.js' },
                    { id: 'python', label: 'Python / LangChain' },
                    { id: 'express', label: 'Express.js' },
                    { id: 'curl', label: 'cURL' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setSnippetLanguage(lang.id as typeof snippetLanguage)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        snippetLanguage === lang.id
                          ? 'bg-white text-[var(--warm-ink)] shadow-sm'
                          : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => copyToClipboard(codeSnippets[snippetLanguage], 'snippet')}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[rgba(191,179,163,0.4)] hover:bg-[var(--warm-sand)] transition-all shadow-sm z-10"
                  style={{ color: 'var(--warm-ink)' }}
                >
                  {copiedKey === 'snippet' ? 'Copied Code!' : 'Copy Snippet'}
                </button>

                <pre
                  className="p-5 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border"
                  style={{
                    background: 'rgba(28,25,23,0.03)',
                    borderColor: 'rgba(191,179,163,0.35)',
                    color: 'var(--warm-ink)',
                  }}
                >
                  <code>{codeSnippets[snippetLanguage]}</code>
                </pre>
              </div>
            </ClayCard>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
