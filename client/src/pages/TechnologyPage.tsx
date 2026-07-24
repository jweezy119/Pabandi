import { Link } from 'react-router-dom';
import {
  Button,
  Chip,
  Surface,
  Section,
  Stack,
  Badge,
  tokens,
} from '../design-system';

const trustLayers = [
  {
    title: 'Behavioral History',
    body: 'Analyze booking ledgers across the network. Chronic no-shows and cancel timing are calculated into an exact reliability metric.',
  },
  {
    title: 'Verified Identity (KYC)',
    body: 'Government-grade ID verification filters bots. Check-ins are verified with GPS plus timestamp—no location tracking outside appointments.',
  },
  {
    title: 'Social Graph Analytics',
    body: 'Verified LinkedIn, Fiverr, Upwork, and Meta account age/ratings lower no-show probability and boost trust scores.',
  },
  {
    title: 'On-Chain Footprint',
    body: 'Web3 wallet behavior is treated as the strongest commitment signal. Solana escrow participation is measurable and immutable.',
  },
];

const enterpriseCards = [
  { title: '99.99% Uptime SLA', body: 'Globally distributed infrastructure keeps booking flows available during traffic spikes.' },
  { title: 'TypeScript SDK', body: 'Drop-in package for Node.js and browser apps to access risk scoring and Web3 payments.' },
  { title: 'Pay-As-You-Go', body: 'API billing by exact usage, with fiat and $PAB settlement options for developers.' },
];

const web3Cards = [
  { title: 'Trustless Escrow', body: 'Solana smart contracts lock deposits and release upon verified booking outcomes.' },
  { title: '$PAB Token Rewards', body: 'Reliability is rewarded. Check-ins and honored bookings earn $PAB automatically.' },
  { title: 'Instant Payouts', body: 'Settlement on Solana moves from event to buyer/seller in milliseconds.' },
];

export default function TechnologyPage() {
  return (
    <div
      className="min-h-screen text-slate-100 antialiased"
      style={{ background: tokens.color.background, fontFamily: tokens.font.body }}
    >
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Chip tone="info">Next-Generation Infrastructure</Chip>
          <h1
            className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #818cf8 50%, #c084fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            WhatsApp-native commerce escrow layer.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-300">
            Zero training for merchants and buyers. AI-backed booking support, contactless escrow checkout, and verified commitment for the informal economy.
          </p>
        </div>
      </section>

      {/* AI Risk Engine */}
      <Section
        title="Breakthrough AI Risk Engine"
        description="Predict no-show probability in real time, then apply safeguards only where the risk is real."
      >
        <Surface className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-slate-300">
            Machine learning models analyze booking behavior, time patterns, and trust signals to assign precise deposit logic.
          </p>
          <Stack>
            <div className="flex items-start gap-3">
              <Badge tone="success">Predictive</Badge>
              <p className="text-sm text-slate-300">Identifies high-risk bookings from historical patterns before confirmation.</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge tone="info">Dynamic</Badge>
              <p className="text-sm text-slate-300">Requires deposits only when risk thresholds are exceeded.</p>
            </div>
          </Stack>
        </Surface>
      </Section>

      {/* Trust Matrix */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Chip tone="info">The 4 Data Layers</Chip>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-100">The Trust Matrix Engine</h2>
          <p className="mt-3 text-slate-300">Fuses four verifiable signals into a single cryptographic trust standard.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trustLayers.map((item) => (
            <Surface key={item.title} className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-300">{item.body}</p>
            </Surface>
          ))}
        </div>
      </section>

      {/* Enterprise API */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 sm:p-8 backdrop-blur-xl">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <Chip tone="success">Developer First</Chip>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-100">Enterprise-Grade API & SDKs</h2>
            <p className="mt-3 text-slate-300">
              Integrate trust scoring and Solana escrow directly into your stack.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {enterpriseCards.map((item) => (
              <Surface key={item.title} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                <p className="text-xs leading-relaxed text-slate-300">{item.body}</p>
              </Surface>
            ))}
          </div>
        </div>
      </section>

      {/* Alibaba Integration */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <Stack>
            <Chip tone="warning">Alibaba Cloud & AI</Chip>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
              Global scale, sub-millisecond risk inference.
            </h2>
            <p className="text-slate-300">
              Qwen models negotiate deposits and run multilingual WhatsApp confirmations across availability zones.
            </p>
            <Stack>
              <div className="flex items-start gap-3">
                <Badge tone="info">Global Scaling</Badge>
                <p className="text-sm text-slate-300">Cross-zone deployment keeps real-time booking flows online.</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge tone="warning">Qwen AI</Badge>
                <p className="text-sm text-slate-300">Autonomous multilingual outreach and deposit negotiation.</p>
              </div>
            </Stack>
          </Stack>

          <Surface className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 p-4">
              <span className="text-sm text-slate-300">Alibaba Cloud CDN</span>
              <Badge tone="success">Active globally</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 p-4">
              <span className="text-sm text-slate-300">Qwen AI Agent Engine</span>
              <Badge tone="success">Processing requests</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 p-4">
              <span className="text-sm text-slate-300">Real-time Data Sync</span>
              <span className="text-sm font-bold text-[#ff6a00]">&lt; 12ms</span>
            </div>
          </Surface>
        </div>
      </section>

      {/* Solana Web3 */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <Surface className="order-2 md:order-1 flex flex-col gap-3">
            {web3Cards.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <Badge tone="success">{item.title}</Badge>
                <p className="text-sm text-slate-300">{item.body}</p>
              </div>
            ))}
          </Surface>

          <Stack className="order-1 md:order-2">
            <Chip tone="info">Solana Web3</Chip>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
              Speed, low cost, irrevocable commitment.
            </h2>
            <p className="text-slate-300">
              The $PAB token rewards reliability, while smart contracts keep deposits protected until verified booking outcomes occur.
            </p>
          </Stack>
        </div>
      </section>

      {/* Pabandi Score */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center backdrop-blur-xl sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-[#f59e0b] to-[#fcd34d] shadow-lg shadow-amber-500/20">
            <span className="material-symbols-outlined text-3xl text-white">workspace_premium</span>
          </div>

          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-100">The Pabandi Score</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            A real-time reputation metric derived from reservations, deposits, on-chain behavior, and social verification.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Surface className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold text-slate-100">900+</div>
              <Chip tone="success">Elite</Chip>
            </Surface>
            <Surface className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold text-slate-100">700-899</div>
              <Chip tone="info">Reliable</Chip>
            </Surface>
            <Surface className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold text-slate-100">&lt; 700</div>
              <Badge tone="danger">Higher Risk</Badge>
            </Surface>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-100 sm:text-3xl">Ready to experience the future of booking?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link to="/"><Button>Explore Venues</Button></Link>
          <Link to="/join"><Button variant="outline">For Businesses</Button></Link>
        </div>
      </section>
    </div>
  );
}
