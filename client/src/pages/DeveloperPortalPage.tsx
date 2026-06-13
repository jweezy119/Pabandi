import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScoreResponse {
  success: boolean;
  data?: {
    requestId: string;
    externalUserId: string;
    reliabilityScore: number;
    riskScore: number;
    riskLevel: string;
    probability: number;
    factors: Record<string, number>;
    depositRecommendation: {
      required: boolean;
      amountPKR: number;
      strategy: string;
      reason: string;
    };
    meta: {
      tier: string;
      quotaUsed: number;
      quotaLimit: number;
      quotaRemaining: number;
      scoredAt: string;
    };
  };
  error?: string;
}

// ─── Pricing tiers data ───────────────────────────────────────────────────────
const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: 'forever',
    calls: '500 calls/month',
    callsRaw: 500,
    color: '#4ade80',
    glowColor: 'rgba(74, 222, 128, 0.15)',
    features: [
      '500 scoring calls/month',
      'POST /score endpoint',
      'GET /usage endpoint',
      'Standard response time',
      'Email support',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$99',
    period: '/month',
    calls: '10,000 calls/month',
    callsRaw: 10000,
    color: '#818cf8',
    glowColor: 'rgba(129, 140, 248, 0.2)',
    features: [
      '10,000 scoring calls/month',
      '$0.012 per overage call',
      'All Starter features',
      'Pabandi user enrichment',
      'Deposit recommendations',
      'Priority email support',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$499',
    period: '/month',
    calls: '100,000 calls/month',
    callsRaw: 100000,
    color: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.2)',
    features: [
      '100,000 scoring calls/month',
      '$0.008 per overage call',
      'All Growth features',
      'White-label integration',
      'Overbooking advice engine',
      'PAB token premium unlock',
      'Dedicated Slack channel',
      'SLA 99.9% uptime',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const CODE_EXAMPLES = {
  curl: `curl -X POST https://api.pabandi.com/external/v1/score \\
  -H "x-api-key: pk_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalUserId": "user_abc123",
    "customerHistory": {
      "totalReservations": 8,
      "noShowCount": 2,
      "averageNoShowRate": 0.25
    },
    "bookingFactors": {
      "advanceBookingDays": 1,
      "isSameDay": true,
      "groupSize": 6,
      "hasSpecialRequests": false
    },
    "businessFactors": {
      "businessCategory": "RESTAURANT",
      "averageNoShowRate": 0.15,
      "requiresDeposit": false
    }
  }'`,
  javascript: `import axios from 'axios';

const PABANDI_API_KEY = process.env.PABANDI_API_KEY;

async function getReliabilityScore(userId, bookingData) {
  const response = await axios.post(
    'https://api.pabandi.com/external/v1/score',
    {
      externalUserId: userId,
      customerHistory: bookingData.customerHistory,
      bookingFactors: bookingData.bookingFactors,
      businessFactors: {
        businessCategory: 'RESTAURANT',
        averageNoShowRate: 0.15,
        requiresDeposit: false,
      },
    },
    {
      headers: {
        'x-api-key': PABANDI_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const { riskLevel, depositRecommendation } = response.data.data;

  if (depositRecommendation.required) {
    await chargeDeposit(userId, depositRecommendation.amountPKR);
  }

  return riskLevel; // 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
}`,
  python: `import requests
import os

PABANDI_API_KEY = os.environ["PABANDI_API_KEY"]
BASE_URL = "https://api.pabandi.com/external/v1"

def get_reliability_score(user_id: str, booking_data: dict) -> dict:
    response = requests.post(
        f"{BASE_URL}/score",
        headers={
            "x-api-key": PABANDI_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "externalUserId": user_id,
            "customerHistory": booking_data.get("customer_history"),
            "bookingFactors": booking_data.get("booking_factors"),
            "businessFactors": {
                "businessCategory": "SALON",
                "averageNoShowRate": 0.12,
                "requiresDeposit": False,
            },
        },
    )
    response.raise_for_status()
    data = response.json()["data"]

    print(f"Risk Level: {data['riskLevel']}")
    print(f"Deposit Required: {data['depositRecommendation']['required']}")
    print(f"Quota Remaining: {data['meta']['quotaRemaining']}")

    return data`,
};

const MOCK_PAYLOAD = {
  externalUserId: 'demo_user_42',
  customerHistory: {
    totalReservations: 12,
    noShowCount: 3,
    averageNoShowRate: 0.25,
  },
  bookingFactors: {
    advanceBookingDays: 0,
    isSameDay: true,
    groupSize: 8,
    hasSpecialRequests: false,
  },
  businessFactors: {
    businessCategory: 'RESTAURANT',
    averageNoShowRate: 0.15,
    requiresDeposit: false,
  },
};

// ─── Syntax highlighted JSON viewer ──────────────────────────────────────────
function JsonViewer({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  const highlighted = json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'color:#a5f3fc'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'color:#c4b5fd'; // key
        } else {
          cls = 'color:#86efac'; // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'color:#fbbf24'; // boolean
      } else if (/null/.test(match)) {
        cls = 'color:#f87171'; // null
      }
      return `<span style="${cls}">${match}</span>`;
    });
  return (
    <pre
      dangerouslySetInnerHTML={{ __html: highlighted }}
      style={{
        fontSize: '12px',
        lineHeight: '1.6',
        overflowX: 'auto',
        margin: 0,
        color: '#e2e8f0',
      }}
    />
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = Math.ceil(target / 60);
          const timer = setInterval(() => {
            start = Math.min(start + step, target);
            setCount(start);
            if (start >= target) clearInterval(timer);
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    LOW: '#22c55e',
    MODERATE: '#f59e0b',
    HIGH: '#ef4444',
    CRITICAL: '#dc2626',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '20px',
        background: colors[level] + '25',
        color: colors[level],
        border: `1px solid ${colors[level]}50`,
        fontWeight: 700,
        fontSize: '12px',
        letterSpacing: '0.05em',
      }}
    >
      {level}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DeveloperPortalPage() {
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript' | 'python'>('curl');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ScoreResponse | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const runPlayground = async () => {
    setIsLoading(true);
    setResponse(null);
    try {
      const res = await fetch('/external/v1/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || 'pk_demo_playground',
        },
        body: JSON.stringify(MOCK_PAYLOAD),
      });
      const data = await res.json();
      setResponse(data);
    } catch {
      setResponse({
        success: false,
        error: 'Could not reach the API. Make sure the server is running.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ background: '#020617', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(129,140,248,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)',
            borderRadius: '20px', padding: '6px 16px', marginBottom: '28px',
            fontSize: '13px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.05em',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            INTELLIGENCE AS A SERVICE
          </div>

          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1,
            marginBottom: '20px', letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #ffffff 0%, #818cf8 50%, #c084fc 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            The World's First<br />AI Reliability Score API
          </h1>

          <p style={{ fontSize: '18px', color: '#94a3b8', maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.7 }}>
            Stop losing revenue to no-shows. Integrate Pabandi's AI engine into your booking platform in under 10 minutes and automatically charge deposits to high-risk customers.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#pricing" style={{
              padding: '14px 32px', borderRadius: '12px', fontWeight: 700, fontSize: '15px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', textDecoration: 'none', boxShadow: '0 0 30px rgba(99,102,241,0.4)',
              transition: 'all 0.2s',
            }}>
              Get Your API Key →
            </a>
            <a href="#playground" style={{
              padding: '14px 32px', borderRadius: '12px', fontWeight: 600, fontSize: '15px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#e2e8f0', textDecoration: 'none',
            }}>
              Try Live Demo
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '20px 24px 60px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {[
            { label: 'Industries Supported', value: 6, suffix: '' },
            { label: 'Risk Factors Analyzed', value: 18, suffix: '+' },
            { label: 'Prediction Accuracy', value: 87, suffix: '%' },
            { label: 'Avg. Response Time', value: 45, suffix: 'ms' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px', padding: '28px 24px', textAlign: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ fontSize: '40px', fontWeight: 800, color: '#818cf8', lineHeight: 1 }}>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '8px', fontWeight: 500 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '32px', fontWeight: 700, marginBottom: '48px', letterSpacing: '-0.02em' }}>
          How the API Works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          {[
            { step: '01', icon: '📤', title: 'Send Booking Data', desc: 'POST user history, booking details, and business category to our /score endpoint.' },
            { step: '02', icon: '🧠', title: 'AI Scores the Risk', desc: 'Our engine analyzes 18+ factors including no-show history, time patterns, and industry modifiers.' },
            { step: '03', icon: '📊', title: 'Receive the Score', desc: 'Get back a risk level (LOW → CRITICAL), reliability score 0–100, and a dynamic deposit amount.' },
            { step: '04', icon: '💰', title: 'Charge the Deposit', desc: 'Automatically require a deposit from high-risk customers. Reduce no-shows by up to 70%.' },
          ].map((item) => (
            <div key={item.step} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px', padding: '28px 24px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: '16px', right: '20px', fontSize: '48px', fontWeight: 900,
                color: 'rgba(255,255,255,0.04)', lineHeight: 1,
              }}>{item.step}</div>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>{item.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: '17px', marginBottom: '8px', color: '#f1f5f9' }}>{item.title}</h3>
              <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Code examples ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Integrate in Minutes
        </h2>
        <p style={{ color: '#64748b', marginBottom: '32px' }}>One endpoint. Any language. Live in one afternoon.</p>

        <div style={{ background: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', padding: '16px 20px 0', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {(['curl', 'javascript', 'python'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveTab(lang)}
                style={{
                  padding: '8px 20px', borderRadius: '8px 8px 0 0', border: 'none',
                  background: activeTab === lang ? '#1e293b' : 'transparent',
                  color: activeTab === lang ? '#e2e8f0' : '#64748b',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  borderBottom: activeTab === lang ? '2px solid #818cf8' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => handleCopy(CODE_EXAMPLES[activeTab], 'code')}
              style={{
                alignSelf: 'center', padding: '6px 14px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', fontSize: '12px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {copied === 'code' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ padding: '24px 28px', overflowX: 'auto' }}>
            <pre style={{ margin: 0, fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', fontFamily: "'Fira Code', 'JetBrains Mono', monospace" }}>
              {CODE_EXAMPLES[activeTab]}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Live Playground ───────────────────────────────────────────────────── */}
      <section id="playground" style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%)',
          border: '1px solid rgba(129,140,248,0.2)', borderRadius: '24px', padding: '40px',
        }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>🧪 Live API Playground</h2>
          <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '14px' }}>
            Enter your API key (or leave blank to test with the demo key) and fire a real request.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Request panel */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em', marginBottom: '8px' }}>
                YOUR API KEY
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pk_live_..."
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0', outline: 'none', marginBottom: '20px',
                  fontFamily: "'Fira Code', monospace", boxSizing: 'border-box',
                }}
              />

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em', marginBottom: '8px' }}>
                REQUEST BODY (READ-ONLY)
              </label>
              <div style={{ background: '#020617', borderRadius: '10px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)', minHeight: '220px' }}>
                <JsonViewer data={MOCK_PAYLOAD} />
              </div>

              <button
                id="playground-run-btn"
                onClick={runPlayground}
                disabled={isLoading}
                style={{
                  marginTop: '16px', width: '100%', padding: '14px', borderRadius: '12px',
                  background: isLoading ? '#334155' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '15px',
                  cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  boxShadow: isLoading ? 'none' : '0 0 20px rgba(99,102,241,0.4)',
                }}
              >
                {isLoading ? '⚡ Analyzing...' : '▶ Run Request'}
              </button>
            </div>

            {/* Response panel */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em', marginBottom: '8px' }}>
                RESPONSE
              </label>
              <div style={{
                background: '#020617', borderRadius: '10px', padding: '20px',
                border: '1px solid rgba(255,255,255,0.08)', minHeight: '340px',
                position: 'relative',
              }}>
                {!response && !isLoading && (
                  <div style={{ textAlign: 'center', paddingTop: '60px', color: '#334155' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📡</div>
                    <div style={{ fontSize: '14px' }}>Hit "Run Request" to see the live response</div>
                  </div>
                )}
                {isLoading && (
                  <div style={{ textAlign: 'center', paddingTop: '60px', color: '#818cf8' }}>
                    <div style={{ fontSize: '14px', marginBottom: '12px' }}>⚡ Calling AI engine...</div>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(129,140,248,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                )}
                {response && !isLoading && (
                  <>
                    {response.success && response.data && (
                      <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e' }}>✓ 200 OK</span>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Score: <strong style={{ color: '#f1f5f9' }}>{response.data.reliabilityScore}</strong></span>
                        <RiskBadge level={response.data.riskLevel} />
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Deposit: <strong style={{ color: '#f1f5f9' }}>PKR {response.data.depositRecommendation?.amountPKR?.toLocaleString() ?? 0}</strong></span>
                      </div>
                    )}
                    {!response.success && (
                      <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>Error: {response.error}</span>
                      </div>
                    )}
                    <JsonViewer data={response} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Badge Verification API ─────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.02em' }}>
              🏅 Badge Verification API
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, maxWidth: '560px' }}>
              Verify any user's Pabandi Reliability Badge from your platform. A public, signed endpoint that LinkedIn, Fiverr, and Upwork can query in-app to show real-world trust signals next to profiles.
            </p>
          </div>
          <a href="/trust" style={{ padding: '10px 20px', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '10px', color: '#818cf8', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
            Trust Layer → 
          </a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Endpoint reference */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { method: 'GET', path: '/api/v1/badge/:pseudonymousId', auth: 'PUBLIC', desc: 'No API key needed. Returns signed badge JSON for any pseudonymous ID. For embedding in external platform profiles.' },
              { method: 'GET', path: '/external/v1/badge/:pseudonymousId', auth: 'API KEY', desc: 'Requires x-api-key header. Same payload — for automated B2B integrations and bulk verification.' },
              { method: 'GET', path: '/api/v1/social/my-badge', auth: 'USER JWT', desc: 'Returns the authenticated user\'s own badge plus their pseudonymous ID for sharing.' },
            ].map(ep => (
              <div key={ep.path} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 8px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>{ep.method}</span>
                  <span style={{ padding: '2px 8px', background: ep.auth === 'PUBLIC' ? 'rgba(251,191,36,0.12)' : 'rgba(129,140,248,0.1)', color: ep.auth === 'PUBLIC' ? '#fbbf24' : '#818cf8', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>{ep.auth}</span>
                </div>
                <code style={{ display: 'block', fontSize: '12px', color: '#c4b5fd', fontFamily: "'Fira Code', monospace", marginBottom: '8px', wordBreak: 'break-all' }}>{ep.path}</code>
                <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{ep.desc}</p>
              </div>
            ))}
          </div>

          {/* Response shape */}
          <div style={{ background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', fontWeight: 700, color: '#818cf8', letterSpacing: '0.06em' }}>
              EXAMPLE BADGE RESPONSE
            </div>
            <div style={{ padding: '20px' }}>
              <pre style={{ fontSize: '12px', lineHeight: 1.7, color: '#e2e8f0', margin: 0, overflowX: 'auto', fontFamily: "'Fira Code', monospace" }}>{`{
  "success": true,
  "data": {
    "pseudonymousId": "a3f9b2c8...",
    "tier": "EXCELLENT",
    "reliabilityScore": 92,
    "attendanceRate": 97,
    "totalBookings": 44,
    "completedBookings": 42,
    "socialSignals": [
      "LINKEDIN",
      "FIVERR"
    ],
    "badges": [
      "Perfect Record",
      "LinkedIn Luminary",
      "Freelancer Star"
    ],
    "socialTrustBoost": 13,
    "verifiedAt": "2026-06-13T18:00:00Z",
    "signedHash": "sha256:e7f4..."
  }
}`}</pre>
            </div>
          </div>
        </div>

        {/* Social platform integration guide */}
        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {[
            { platform: 'LinkedIn', emoji: '💼', color: '#0A66C2', desc: 'Show the Pabandi badge on company pages and member profiles. Link to the /verify page for live stats.' },
            { platform: 'Fiverr', emoji: '🟢', color: '#1DBF73', desc: 'Display in seller profile sidebar. Clients see physical-world punctuality next to star ratings.' },
            { platform: 'Upwork', emoji: '🔵', color: '#14A800', desc: 'Badge in agency or freelancer profile. Verified in-person reliability for last-mile gig placement.' },
            { platform: 'X / Truth Social', emoji: '🐦', color: '#818cf8', desc: 'Link badge URL in bio. Share auto-generated check-in cards and earn +2 PAB per share.' },
          ].map(item => (
            <div key={item.platform} style={{ background: `${item.color}08`, border: `1px solid ${item.color}25`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>{item.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: item.color, marginBottom: '4px' }}>{item.platform}</div>
              <p style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '32px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.02em' }}>Simple, Usage-Based Pricing</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '48px' }}>Start free. Scale as you grow. No surprise bills.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              style={{
                background: tier.popular
                  ? `linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)`
                  : 'rgba(255,255,255,0.03)',
                border: tier.popular ? `1px solid rgba(129,140,248,0.4)` : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px', padding: '32px 28px', position: 'relative',
                boxShadow: tier.popular ? `0 0 40px ${tier.glowColor}` : 'none',
                transition: 'transform 0.2s',
              }}
            >
              {tier.popular && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '20px',
                  padding: '4px 16px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#fff',
                }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ color: tier.color, fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', marginBottom: '12px' }}>
                {tier.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1 }}>{tier.price}</span>
                <span style={{ color: '#64748b', fontSize: '14px' }}>{tier.period}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '28px' }}>{tier.calls}</div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '14px', color: '#94a3b8' }}>
                    <span style={{ color: tier.color, fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#get-key"
                style={{
                  display: 'block', textAlign: 'center', padding: '12px',
                  borderRadius: '10px', fontWeight: 700, fontSize: '14px',
                  textDecoration: 'none', transition: 'all 0.2s',
                  background: tier.popular
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : `rgba(${tier.color === '#4ade80' ? '74,222,128' : tier.color === '#fb923c' ? '251,146,60' : '129,140,248'},0.1)`,
                  color: tier.popular ? '#fff' : tier.color,
                  border: tier.popular ? 'none' : `1px solid ${tier.color}30`,
                  boxShadow: tier.popular ? '0 0 20px rgba(99,102,241,0.35)' : 'none',
                }}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Response shape explainer ──────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px' }}>What You Get Back</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { field: 'reliabilityScore', type: 'number (0–100)', desc: 'Overall user reliability. Higher = more trustworthy.' },
            { field: 'riskLevel', type: '"LOW" | "MODERATE" | "HIGH" | "CRITICAL"', desc: 'Human-readable risk category.' },
            { field: 'riskScore', type: 'number (0–100)', desc: 'Raw AI risk score. Lower is better.' },
            { field: 'factors', type: 'object', desc: 'Breakdown of what drove the score. Useful for showing customers.' },
            { field: 'depositRecommendation', type: 'object', desc: 'Whether to charge a deposit, how much (in PKR), and why.' },
            { field: 'overbookingAdvice', type: 'object | null', desc: 'For event venues: safe overbook margin and recommended capacity.' },
            { field: 'meta.quotaRemaining', type: 'number', desc: 'Calls left in your current billing period.' },
            { field: 'pabandiEnriched', type: 'boolean', desc: 'True if a matching Pabandi user was found and used to enrich the score.' },
          ].map((item) => (
            <div key={item.field} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px', padding: '18px 20px',
            }}>
              <div style={{ fontFamily: "'Fira Code', monospace", color: '#c4b5fd', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                {item.field}
              </div>
              <div style={{ color: '#a5f3fc', fontSize: '11px', marginBottom: '6px' }}>{item.type}</div>
              <div style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Get API Key CTA ───────────────────────────────────────────────────── */}
      <section id="get-key" style={{ padding: '0 24px 100px', maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px', padding: '48px 40px',
        }}>
          {submitted ? (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>You're on the waitlist!</h3>
              <p style={{ color: '#64748b', fontSize: '14px' }}>We'll reach out to {email} with your API key within 24 hours.</p>
              <Link to="/" style={{ display: 'inline-block', marginTop: '24px', color: '#818cf8', fontSize: '14px', fontWeight: 600 }}>← Back to Pabandi</Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>Get Your API Key</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
                Join the waitlist for early access. We'll provision your key and onboard you personally.
              </p>

              <input
                type="text"
                placeholder="Company / App Name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0', outline: 'none', marginBottom: '12px', boxSizing: 'border-box',
                }}
              />
              <input
                id="developer-email-input"
                type="email"
                placeholder="Work Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0', outline: 'none', marginBottom: '20px', boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                {TIERS.map((t) => (
                  <div key={t.id} style={{ fontSize: '12px', color: t.color, background: `${t.color}15`, border: `1px solid ${t.color}30`, padding: '4px 12px', borderRadius: '20px' }}>
                    {t.name} — {t.price}
                  </div>
                ))}
              </div>

              <button
                id="developer-submit-btn"
                onClick={() => { if (email && company) setSubmitted(true); }}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '15px',
                  cursor: 'pointer', boxShadow: '0 0 25px rgba(99,102,241,0.4)',
                }}
              >
                Request Early Access →
              </button>
              <p style={{ marginTop: '12px', color: '#475569', fontSize: '12px' }}>No credit card required for Starter tier.</p>
            </>
          )}
        </div>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
