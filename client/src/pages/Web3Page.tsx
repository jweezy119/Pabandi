import { useLanguage } from '../context/LanguageContext';
import { Chip, Surface, Section, Stack, Badge, tokens } from '../design-system';

const solanaCards = [
  { title: 'Instant Finality', body: 'Solana finalizes blocks in ~400ms, which means escrow lock and release can happen in the same user flow.' },
  { title: 'Minimal Fees', body: 'Settlement costs stay low under load, making micro-deposits realistic for local bookings.' },
  { title: 'Programmable Trust', body: 'Smart contract rules enforce release, refund, and forfeit without manual review.' },
];

const bitcoinCards = [
  { title: 'Cross-Chain Liquidity', body: 'BTC-backed assets can be routed into Pabandi pools without forcing users to sell.' },
  { title: 'Reserve-Grade Value', body: 'Bitcoin acts as a high-trust reserve layer for large-value escrows and treasury operations.' },
  { title: 'Bridge-Aware UX', body: 'Bridge flows should feel native; Pabandi treats BTC as settlement, not a marketing buzzword.' },
];

const poolCards = [
  { title: 'Escrow Liquidity Pool', body: 'Funds back real bookings and cover guarantee events. Returns come from booking activity, not token inflation.', tone: 'info' },
  { title: 'Governance Pool', body: 'Voting power over city launches, parameter changes, and reserve policy. Use it to steer protocol decisions.', tone: 'warning' },
];

export default function Web3Page() {
  const { t } = useLanguage();

  return (
    <div
      className="min-h-screen text-slate-100 antialiased"
      style={{ background: tokens.color.background, fontFamily: tokens.font.body }}
    >
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Chip tone="info">Web3 Made Simple</Chip>
          <h1
            className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl"
            style={{
              background: 'linear-gradient(135deg, #14F195 0%, #9945FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t('Web3 without the jargon.', 'Web3 asaan alfaz mein.')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-300">
            {t(
              'You don’t need to understand crypto to use Pabandi. Web3 is the trust layer behind WhatsApp checkout: deposit protection, verified commitment, and portable reputation.',
              'Aapko crypto seekhne ki zaroorat nahi. Pabandi mein Web3 trust layer hai: deposit protection, verified commitment, aur portable reputation.'
            )}
          </p>
        </div>
      </section>

      {/* Staking */}
      <Section
        title={t('Simplified Staking', 'Staking Aasaan Alfaz Mein')}
        description={t(
          "Treat staking like a security deposit. You lock tokens temporarily to prove reliability, without losing ownership.",
          "Staking ko security deposit samajhein. Tokens lock kar ke aap apni reliability sabit karte hain, ownership nahi khote."
        )}
      >
        <Surface className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-slate-300">
            {t(
              'Staked liquidity backs real-world bookings. In return, participants earn a share of platform booking fees.',
              'Staked liquidity real-world bookings ko back karta hai. Iske badle mein participants ko platform fees ka hissa milta hai.'
            )}
          </p>
          <Stack>
            <div className="flex items-start gap-3">
              <Badge tone="success">{t('Backed by bookings', 'Bookings se backed')}</Badge>
              <p className="text-sm text-slate-300">
                {t('Escrow liquidity is tied to real transactions, not synthetic yield.', 'Escrow liquidity real transactions se tied hai, synthetic yield nahi.')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge tone="info">{t('Halal-aligned incentives', 'Halal-aligned incentives')}</Badge>
              <p className="text-sm text-slate-300">
                {t('Rewards come from verified activity: check-ins, honored bookings, and trust contributions.', 'Rewards verified activity se aate hain: check-ins, honored bookings, aur trust contributions.')}
              </p>
            </div>
          </Stack>
        </Surface>
      </Section>

      {/* Networks */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Chip tone="info">{t('Best-of-both networks', 'Best-of-both networks')}</Chip>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-100">
            {t('Powered by Solana, connected to Bitcoin', 'Solana par mabni, Bitcoin se munsalik')}
          </h2>
          <p className="mt-3 text-slate-300">
            {t(
              'Speed for checkout, and a trusted reserve asset for long-term value. No evangelism, just reliable mechanics.',
              'Checkout ke liye tezi, aur long-term value ke liye trusted reserve asset. Na sirf dehshat, na sirf shan, asli mechanics.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Surface className="flex flex-col gap-3">
            <div className="text-2xl font-bold text-slate-100">Solana</div>
            <p className="text-sm text-slate-300">
              {t('The execution layer for escrow contracts. Fast, cheap, and programmable.', 'Escrow contracts ka execution layer. Taiz, sasta, aur programmable.')}
            </p>
            <Stack>
              {solanaCards.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <Badge tone="success">{item.title}</Badge>
                  <p className="text-sm text-slate-300">{item.body}</p>
                </div>
              ))}
            </Stack>
          </Surface>

          <Surface className="flex flex-col gap-3">
            <div className="text-2xl font-bold text-slate-100">Bitcoin</div>
            <p className="text-sm text-slate-300">
              {t('The reserve-grade value layer for cross-chain liquidity and treasury risk management.', 'Cross-chain liquidity aur treasury risk management ke liye reserve-grade value layer.')}
            </p>
            <Stack>
              {bitcoinCards.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <Badge tone="warning">{item.title}</Badge>
                  <p className="text-sm text-slate-300">{item.body}</p>
                </div>
              ))}
            </Stack>
          </Surface>
        </div>
      </section>

      {/* Pools */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center backdrop-blur-xl sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-[#f59e0b] to-[#fcd34d] shadow-lg shadow-amber-500/20">
            <span className="text-3xl">🏊</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-100">
            {t('The Two Pools', 'Do Kism Ke Pools')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            {t(
              'Choose how your tokens participate. Each pool matches a different goal: booking guarantees or protocol governance.',
              'Choose karen ke aapke tokens kaise share karein. Har pool ka aik maqsad hai: booking guarantees ya protocol governance.'
            )}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {poolCards.map((item) => (
              <Surface key={item.title} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                <p className="text-xs leading-relaxed text-slate-300">{item.body}</p>
                <Badge tone={item.tone as any}>
                  {item.title === 'Escrow Liquidity Pool' ? t('Yield from activity', 'Activity se yield') : t('Voting + influence', 'Voting + influence')}
                </Badge>
              </Surface>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
