import React, { useState } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  Heart, ShieldCheck, Users, MessageCircle, Mail, ArrowRight,
  ArrowDown, Check, Sparkles, Eye, LockKeyhole, Handshake,
  Lightbulb, Puzzle, HelpCircle, Send,
} from 'lucide-react';

/**
 * /contact-us — a warm, open invitation to get in touch.
 *
 * Pabandi has no formal partnership program (yet). This page is deliberately
 * not a funnel: it is an honest, customer-first invitation to build together,
 * with the promises we make about trust and transparency spelled out plainly.
 * It lives inside <Layout />, so site chrome is already present.
 */

const CONTACT_EMAIL = 'jay@pabandi.com';
const HELLO_EMAIL = 'hello@pabandi.com';

const PILLARS = [
  {
    icon: Heart,
    color: 'var(--clay)',
    title: 'Customer first. Always.',
    body: 'Every decision starts with the person on the other side of the booking. If it does not make their life easier, safer, or more honest, we do not build it. Your experience is the product.',
  },
  {
    icon: ShieldCheck,
    color: 'var(--sage)',
    title: 'Honest by default.',
    body: 'Trust is not a badge we hand out — it is a record anyone can check. Clear terms, no hidden fees, and a verifiable trail behind every reputation and deposit on Pabandi.',
  },
  {
    icon: Handshake,
    color: 'var(--muted-ochre)',
    title: 'We build together.',
    body: 'The best ideas come from the people using the product. Tell us what is working, what is not, and what you wish existed. We read every message and it shapes what we build next.',
  },
];

const PROMISES = [
  { icon: Eye, text: 'Plain-language pricing — no surprise fees, ever.' },
  { icon: MessageCircle, text: 'Honest about our limits — we tell you what we cannot do yet.' },
  { icon: ShieldCheck, text: 'Verifiable trust — check a score or a deposit for yourself.' },
  { icon: LockKeyhole, text: 'Your data stays yours — we never sell it or misuse it.' },
  { icon: Users, text: 'Real humans reply — no maze of bots before you reach a person.' },
  { icon: Sparkles, text: 'We own our mistakes — and fix them in the open.' },
];

const TOPICS = [
  { icon: Lightbulb, label: 'An idea or feedback', note: 'We love a good "what if".' },
  { icon: Puzzle, label: 'Working together', note: 'Integrations, collaborations, or just saying hi.' },
  { icon: HelpCircle, label: 'A problem to solve', note: 'Tell us what is getting in your way.' },
  { icon: Mail, label: 'Press or anything else', note: 'No question is too small.' },
];

function SectionHeading({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="text-center mb-10 reveal">
      <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)] mb-3">{kicker}</span>
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--warm-ink)] font-headline">{title}</h2>
      {sub && <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto leading-relaxed">{sub}</p>}
    </div>
  );
}

export default function ContactUsPage() {
  const heroRef = useScrollReveal<HTMLDivElement>();
  const valuesRef = useScrollReveal<HTMLElement>();
  const promisesRef = useScrollReveal<HTMLElement>();
  const topicsRef = useScrollReveal<HTMLElement>();
  const formRef = useScrollReveal<HTMLElement>();

  const [form, setForm] = useState({ name: '', email: '', topic: 'An idea or feedback', message: '' });
  const [sent, setSent] = useState(false);

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `Hello from ${form.name} — ${form.topic}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Reaching about: ${form.topic}`,
      '',
      form.message,
    ].join('\n');
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  const ctaClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--clay)] text-white px-6 py-3 text-sm font-bold shadow-[var(--shadow-btn)] hover:bg-[var(--terracotta)] hover:-translate-y-[1px] transition-all duration-200';
  const ghostClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--clay)]/40 text-[var(--terracotta)] px-6 py-3 text-sm font-bold hover:bg-[var(--clay)]/10 transition-all duration-200';
  const cardClass = 'bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.25)] rounded-3xl shadow-[var(--shadow-soft)]';

  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--warm-ink)]">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div ref={heroRef} className="reveal">
        <section className="relative w-full pt-20 pb-16 md:pt-24 md:pb-20 px-4 sm:px-6 md:px-10 flex flex-col items-center justify-center text-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute top-[-12%] left-[18%] w-[36rem] h-[36rem] bg-[var(--clay)] rounded-full mix-blend-multiply filter blur-[150px] opacity-15" />
            <div className="absolute bottom-[-16%] right-[16%] w-[34rem] h-[34rem] bg-[var(--sage)] rounded-full mix-blend-multiply filter blur-[150px] opacity-20" />
          </div>
          <div className="relative z-10 max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--clay)]/25 bg-[var(--clay)]/10 px-4 py-1.5 text-sm font-semibold text-[var(--terracotta)] mb-6">
              <Heart size={15} />
              We'd love to hear from you
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-headline leading-[1.08] mb-6">
              Let's build something<br />
              <span className="text-[var(--clay)]">good — together.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[var(--soft-stone)] max-w-3xl mx-auto font-light leading-relaxed">
              Pabandi is growing with the people who use it. No formal program, no sales pitch — just an open invitation to talk. Tell us what you're thinking, what you need, or what we could do better.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <a href="#say-hello" className={ctaClass}>
                Say hello <ArrowRight size={16} />
              </a>
              <a href="#how-we-work" className={ghostClass}>
                How we work <ArrowDown size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* Customer-first banner */}
        <section className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto pb-10">
          <div className="rounded-3xl bg-[var(--clay)]/10 border border-[var(--clay)]/25 px-6 py-7 md:px-10 md:py-9 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)] mb-2">Our first principle</p>
            <p className="text-xl md:text-2xl font-bold font-headline text-[var(--warm-ink)] leading-snug">
              "If it doesn't help the customer, it doesn't ship."
            </p>
            <p className="text-sm text-[var(--soft-stone)] mt-2 max-w-2xl mx-auto">
              That simple rule keeps us honest about what we build, how we charge, and who we answer to — you.
            </p>
          </div>
        </section>
      </div>

      {/* ── Our values ──────────────────────────────────────────────────── */}
      <section ref={valuesRef} id="how-we-work" className="w-full px-4 sm:px-6 md:px-10 max-w-6xl mx-auto py-14">
        <div className="reveal">
          <SectionHeading
            kicker="How we work"
            title="The values behind every conversation"
            sub="These are not slogans on a wall. They are the promises we make to everyone who puts their trust in Pabandi."
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PILLARS.map((p) => (
            <div key={p.title} className={`${cardClass} p-6 md:p-7 reveal`}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${p.color} 18%, transparent)` }}>
                <p.icon size={22} style={{ color: p.color }} />
              </div>
              <h3 className="text-xl font-bold font-headline mt-4">{p.title}</h3>
              <p className="text-sm text-[var(--soft-stone)] leading-relaxed mt-2">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Transparency promises ───────────────────────────────────────── */}
      <section ref={promisesRef} className="w-full px-4 sm:px-6 md:px-10 max-w-6xl mx-auto py-14">
        <div className={`${cardClass} p-6 md:p-10`}>
          <div className="reveal">
            <SectionHeading
              kicker="Trust & transparency"
              title="How we keep faith with you"
              sub="Trust means little if it cannot be checked. Here is what we commit to, in plain words."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROMISES.map((item) => (
              <div key={item.text} className="flex items-start gap-3 rounded-2xl bg-[var(--cream)]/80 border border-[rgba(191,179,163,0.25)] p-4 reveal">
                <span className="w-9 h-9 rounded-xl bg-[var(--sage)]/15 flex items-center justify-center shrink-0">
                  <item.icon size={17} className="text-[var(--sage)]" />
                </span>
                <p className="text-sm text-[var(--warm-ink)] leading-relaxed pt-1.5">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What to talk about ──────────────────────────────────────────── */}
      <section ref={topicsRef} className="w-full px-4 sm:px-6 md:px-10 max-w-6xl mx-auto py-14">
        <div className="reveal">
          <SectionHeading kicker="Anything goes" title="What's on your mind?" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOPICS.map((t) => (
            <div key={t.label} className={`${cardClass} p-5 reveal`}>
              <t.icon size={20} className="text-[var(--clay)]" />
              <h3 className="font-bold mt-3">{t.label}</h3>
              <p className="text-xs text-[var(--soft-stone)] mt-1 leading-relaxed">{t.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Say hello ───────────────────────────────────────────────────── */}
      <section ref={formRef} id="say-hello" className="w-full px-4 sm:px-6 md:px-10 max-w-6xl mx-auto py-14 pb-20">
        <div className={`${cardClass} p-6 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 reveal`}>
          <div>
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)] mb-3">
              <MessageCircle size={14} /> Say hello
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-headline leading-tight">Good things start with a conversation.</h2>
            <p className="text-[var(--soft-stone)] mt-3 leading-relaxed max-w-md">
              Drop us a note and a real person will get back to you. We read everything, and we'll be straight with you about what we can do.
            </p>
            <div className="mt-6 space-y-3 text-sm text-[var(--soft-stone)]">
              <p className="flex items-center gap-2"><Mail size={16} className="text-[var(--clay)]" /> <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--warm-ink)] hover:text-[var(--terracotta)]">{CONTACT_EMAIL}</a></p>
              <p className="flex items-center gap-2"><Mail size={16} className="text-[var(--sage)]" /> <a href={`mailto:${HELLO_EMAIL}`} className="font-semibold text-[var(--warm-ink)] hover:text-[var(--terracotta)]">{HELLO_EMAIL}</a></p>
              <p className="flex items-center gap-2"><Users size={16} className="text-[var(--clay)]" /> A human replies — usually within a day.</p>
            </div>
            <div className="mt-6 rounded-2xl bg-[var(--sage)]/10 border border-[var(--sage)]/25 p-4 flex items-start gap-3">
              <Check size={17} className="text-[var(--sage)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
                Your message goes straight to our team. We never share it, sell it, or use it to send you things you didn't ask for.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white/70 border border-[rgba(191,179,163,0.3)] rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--soft-stone)]">Your name</span>
                <input required value={form.name} onChange={update('name')} className="mt-1 w-full rounded-xl border border-[rgba(191,179,163,0.5)] bg-[var(--cream)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--clay)]" placeholder="Ayesha Khan" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--soft-stone)]">Your email</span>
                <input required type="email" value={form.email} onChange={update('email')} className="mt-1 w-full rounded-xl border border-[rgba(191,179,163,0.5)] bg-[var(--cream)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--clay)]" placeholder="you@example.com" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--soft-stone)]">What's this about?</span>
              <select value={form.topic} onChange={update('topic')} className="mt-1 w-full rounded-xl border border-[rgba(191,179,163,0.5)] bg-[var(--cream)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--clay)]">
                <option>An idea or feedback</option>
                <option>Working together</option>
                <option>A problem to solve</option>
                <option>Press or general question</option>
                <option>Something else entirely</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--soft-stone)]">Your message</span>
              <textarea required rows={5} value={form.message} onChange={update('message')} className="mt-1 w-full rounded-xl border border-[rgba(191,179,163,0.5)] bg-[var(--cream)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--clay)] resize-y" placeholder="Tell us what's on your mind…" />
            </label>
            <button type="submit" className={`${ctaClass} w-full`}>
              Send your note <Send size={16} />
            </button>
            {sent && (
              <p className="text-xs text-[var(--sage)] text-center">
                Your email app should open with the message ready to send. If it didn't, just email us at {CONTACT_EMAIL}.
              </p>
            )}
            <p className="text-[11px] text-[var(--soft-stone)] text-center leading-relaxed">
              This opens your email app with everything prefilled — nothing is sent until you confirm.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
