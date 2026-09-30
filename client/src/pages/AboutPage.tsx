import { useScrollReveal } from '../hooks/useScrollReveal';
import { Mail, MessageCircle, ExternalLink, Camera, AtSign } from 'lucide-react';

export default function AboutPage() {
  const heroRef = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const storyRef1 = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const storyRef2 = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const featuresRef = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const socialsRef = useScrollReveal() as React.RefObject<HTMLDivElement>;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <section
        ref={heroRef}
        className="relative w-full pt-24 pb-16 px-4 sm:px-6 md:px-10 flex flex-col items-center justify-center text-center overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-1/4 w-[40rem] h-[40rem] bg-[var(--clay)] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob" />
          <div className="absolute bottom-[-10%] right-1/4 w-[40rem] h-[40rem] bg-[var(--sage)] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-2000" />
        </div>

        <h1 className="relative z-10 text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-[var(--warm-ink)] font-headline mb-6">
          The Story Behind Pabandi
        </h1>
        <p className="relative z-10 text-base sm:text-lg md:text-xl text-[var(--soft-stone)] max-w-3xl font-light leading-relaxed">
          One desk, one ticket, one frustrated user at a time. This is how we are building the universal trust layer for the service economy.
        </p>
      </section>

      <section className="relative w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto space-y-8 md:space-y-12">
        <div ref={storyRef1} className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-10 shadow-[var(--shadow-soft)]">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-6 flex items-center gap-4">
            <span className="w-12 h-12 rounded-full bg-[var(--clay)]/10 text-[var(--clay)] flex items-center justify-center text-2xl border border-[var(--clay)]/20 shrink-0">
              👋
            </span>
            Who is behind Pabandi?
          </h2>
          <div className="space-y-5 text-[var(--soft-stone)] text-base md:text-lg leading-relaxed">
            <p>
              Hi, I'm Syed. I'm not a Silicon Valley insider or a serial entrepreneur. For the last 8 years, I've been the IT guy. The person you call when things break, when systems fail, and when you're just incredibly frustrated.
            </p>
            <p>
              My entire career has been built on a very simple premise: <strong className="text-[var(--warm-ink)] font-medium">listening to people's problems and fixing them.</strong> Whether I was untangling messy networks or automating workflows, my favorite part of the job was always that moment of relief on someone's face when their problem finally went away.
            </p>
            <p>
              But a few years ago, I started noticing a problem I couldn't just fix with a simple IT ticket. I saw incredibly hardworking people—freelancers hustling to make rent, local salon owners, small clinic managers—quietly losing their livelihoods. They were losing money to scammers, to no-shows, and to massive platforms taking 20% of their paychecks.
            </p>
            <p>
              It broke my heart to watch honest people get taken advantage of just because the internet doesn't inherently have a "trust" layer.
            </p>
            <blockquote className="text-lg font-medium text-[var(--warm-ink)] italic border-l-4 border-[var(--clay)] pl-4 py-2 my-6">
              "I realized that being the 'IT guy' wasn't enough anymore. Some systems are so fundamentally broken, you can't just troubleshoot them—you have to rebuild them."
            </blockquote>
            <p>
              So, I spent my nights and weekends teaching myself things I had no business knowing. I dove into Solana smart contracts, AI ensemble models, and Web3 tokenomics. I used AI coding assistants to help me translate the vision in my head into reality. I built Pabandi because I genuinely believe that keeping your word should mean something, and honest work deserves honest protection.
            </p>
          </div>
        </div>

        <div ref={storyRef2} className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-10 shadow-[var(--shadow-soft)]">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-6 flex items-center gap-4">
            <span className="w-12 h-12 rounded-full bg-[var(--sage)]/10 text-[var(--sage)] flex items-center justify-center text-2xl border border-[var(--sage)]/20 shrink-0">
              ❤️
            </span>
            Why does this matter so much?
          </h2>
          <div className="space-y-5 text-[var(--soft-stone)] text-base md:text-lg leading-relaxed">
            <p>
              Because trust is the most expensive thing in the world, especially for people who don't have a lot of money to spare.
            </p>
            <p>
              When a freelancer in an emerging market finishes a job and gets ghosted by a client, it's not just an inconvenience—it's groceries they can't buy. When a local barber has three no-shows on a Saturday morning, they can't make rent. The current system punishes the people who are trying the hardest.
            </p>
            <p>
              Pabandi is my love letter to the builders, the creators, and the service providers of the world. It's an ecosystem designed to protect you. By using smart escrows, the money is guaranteed. By using our AI Trust Oracle, you finally get rewarded for being a reliable human being. And by integrating zero-fee off-ramps, you get to keep the money you actually earned.
            </p>
            <blockquote className="text-lg font-medium text-[var(--warm-ink)] italic border-l-4 border-[var(--sage)] pl-4 py-2 my-6">
              "We aren't just building an app. We are trying to restore humanity and accountability to the digital economy."
            </blockquote>
            <p>
              I might not have started as a typical tech founder, but I have something stronger: a deep, unwavering empathy for the people this is built for. Welcome to Pabandi. We have your back.
            </p>
          </div>
        </div>

        <div ref={featuresRef} className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-10 shadow-[var(--shadow-soft)]">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-6 flex items-center gap-4">
            <span className="w-12 h-12 rounded-full bg-[var(--muted-ochre)]/10 text-[var(--muted-ochre)] flex items-center justify-center text-2xl border border-[var(--muted-ochre)]/20 shrink-0">
              🌍
            </span>
            The Pabandi Ecosystem
          </h2>
          <p className="text-[var(--soft-stone)] mb-6 leading-relaxed">
            Pabandi has evolved into a comprehensive trust and payments protocol, operating through three specialized OS layers:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div className="p-5 rounded-2xl bg-[var(--sage)]/5 border border-[var(--sage)]/15">
              <h3 className="text-lg font-bold text-[var(--sage)] mb-2">🟢 Sitara</h3>
              <p className="text-sm text-[var(--soft-stone)]">Booking & discovery for restaurants, hotels, and services. Earn $PAB rewards for every check-in and review.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[var(--muted-ochre)]/5 border border-[var(--muted-ochre)]/15">
              <h3 className="text-lg font-bold text-[var(--muted-ochre)] mb-2">🟡 Saf OS</h3>
              <p className="text-sm text-[var(--soft-stone)]">Freight & logistics management. Post loads, find carriers, track shipments — all with trust scoring.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[var(--dusty-rose)]/5 border border-[var(--dusty-rose)]/15">
              <h3 className="text-lg font-bold text-[var(--dusty-rose)] mb-2">🟣 Haq OS</h3>
              <p className="text-sm text-[var(--soft-stone)]">Property management for landlords. Manage tenants, leases, maintenance, and revenue in one dashboard.</p>
            </div>
          </div>
          <div className="space-y-4 text-[var(--soft-stone)] leading-relaxed">
            <p>
              Underneath all three is the <strong className="text-[var(--warm-ink)] font-medium">Pabandi Protocol</strong> — powered by Jev AI for fraud detection, $PAB token for rewards, and Solana escrow for trustless settlements.
            </p>
            <p>
              For users in Pakistan, we've integrated <strong className="text-[var(--warm-ink)] font-medium">Raast, JazzCash, and EasyPaisa</strong> for seamless PKR payments. No crypto knowledge needed — just scan, pay, and earn.
            </p>
          </div>
        </div>

        <div ref={socialsRef} className="pt-8 pb-4 text-center">
          <h3 className="text-xl font-semibold text-[var(--warm-ink)] font-headline mb-6">Connect with Pabandi</h3>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="mailto:jay@pabandi.com" className="flex items-center gap-2 px-4 py-2.5 bg-[var(--clay)]/10 hover:bg-[var(--clay)]/15 border border-[var(--clay)]/20 rounded-full text-sm font-medium text-[var(--clay)] transition-colors">
              <Mail size={16} />
              jay@pabandi.com
            </a>
            <a href="https://www.linkedin.com/company/pabandi/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-[#0a66c2]/10 hover:bg-[#0a66c2]/15 border border-[#0a66c2]/20 rounded-full text-sm font-medium text-[#0a66c2] transition-colors">
              <ExternalLink size={16} />
              LinkedIn
            </a>
            <a href="https://x.com/pabandiglobal" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-[var(--warm-sand)]/50 hover:bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-full text-sm font-medium text-[var(--soft-stone)] transition-colors">
              <AtSign size={16} />
              @pabandiglobal
            </a>
            <a href="https://instagram.com/pabandiglobal" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-[var(--dusty-rose)]/10 hover:bg-[var(--dusty-rose)]/15 border border-[var(--dusty-rose)]/20 rounded-full text-sm font-medium text-[var(--dusty-rose)] transition-colors">
              <Camera size={16} />
              pabandiglobal
            </a>
            <a href="https://wa.me/13124896967" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/15 border border-[#25D366]/20 rounded-full text-sm font-medium text-[#25D366] transition-colors">
              <MessageCircle size={16} />
              +1 (312) 489-6967
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
