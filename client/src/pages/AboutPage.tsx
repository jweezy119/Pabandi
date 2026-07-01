import { useScrollReveal } from '../hooks/useScrollReveal';

export default function AboutPage() {
  const heroRef = useScrollReveal() as any;
  const storyRef1 = useScrollReveal() as any;
  const storyRef2 = useScrollReveal() as any;
  const liveSellingRef = useScrollReveal() as any;
  const socialsRef = useScrollReveal() as any;

  return (
    <div className="w-full bg-[#020617] text-white min-h-screen font-body pb-20">
      
      {/* ── HERO SECTION ──────────────────────────────────────────────────────── */}
      <section 
        ref={heroRef}
        className="relative w-full pt-32 pb-20 px-6 md:px-12 flex flex-col items-center justify-center text-center overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-1/4 w-[40rem] h-[40rem] bg-indigo-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob" />
          <div className="absolute bottom-[-10%] right-1/4 w-[40rem] h-[40rem] bg-emerald-500 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-2000" />
        </div>
        
        <h1 className="relative z-10 text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 mb-6 drop-shadow-sm">
          The Story Behind Pabandi
        </h1>
        <p className="relative z-10 text-lg md:text-2xl text-slate-300 max-w-3xl font-light leading-relaxed">
          One desk, one ticket, one frustrated user at a time. This is how we are building the universal trust layer for the service economy.
        </p>
      </section>

      {/* ── THE FOUNDER ───────────────────────────────────────────────────────── */}
      <section className="relative w-full px-6 md:px-12 max-w-5xl mx-auto space-y-24">
        
        {/* Question 1 */}
        <div ref={storyRef1} className="relative p-[1px] rounded-3xl bg-gradient-to-br from-slate-700 to-slate-900 group hover:from-indigo-500 hover:to-purple-500 transition-all duration-500 shadow-xl hover:shadow-indigo-500/20">
          <div className="bg-[#0f172a] rounded-[23px] p-8 md:p-12 h-full backdrop-blur-sm">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 flex items-center gap-4">
              <span className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-2xl border border-indigo-500/30">
                🚀
              </span>
              Why are you the right founder for this?
            </h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed font-light">
              <p>
                I'm not a traditional startup founder. I'm an IT specialist with 8+ years of experience solving real problems for real people — one desk, one ticket, one frustrated user at a time. That's my superpower.
              </p>
              <p>
                My career has been built on three things: <strong className="text-white font-medium">deep technical troubleshooting, automation, and customer obsession.</strong> I've managed Microsoft 365 environments, automated workflows with PowerShell and REST APIs, handled identity and access management, and supported everything from dusty desktops to hybrid cloud infrastructure. In lean teams, I'm the person who bridges the gap between a user's pain and a working solution. That's exactly the muscle Pabandi needs.
              </p>
              <p>
                When I visited Karachi and saw family businesses losing revenue to no-shows — when I spoke to salon owners while preparing for my own wedding and learned that 560 weddings happen in a single day, yet they'd stopped taking reservations because of trust breakdowns — I didn't see an abstract market. I saw a queue of frustrated users. And my IT brain kicked in: <span className="text-emerald-400 font-medium">this is a process problem that automation and data can fix.</span>
              </p>
              <p>
                So I taught myself what I didn't know. I learned about ensemble ML models, Solana smart contracts, and token economics. I used AI coding agents (Gemini, DeepSeek, Hermes) to accelerate development. I built a working web app, designed the escrow architecture, and ran a pilot that cut no-shows by 67%. 
              </p>
              <p className="text-xl font-medium text-white italic border-l-4 border-indigo-500 pl-4 py-2 my-8">
                "I'm not a career founder — I'm a builder who saw a problem, felt it personally, and refused to walk away."
              </p>
              <p>
                That tenacity, combined with my IT roots and customer-first wiring, makes me the right person to turn Pabandi into the trust layer the service economy desperately needs.
              </p>
            </div>
          </div>
        </div>

        {/* Question 2 */}
        <div ref={storyRef2} className="relative p-[1px] rounded-3xl bg-gradient-to-br from-slate-700 to-slate-900 group hover:from-emerald-500 hover:to-teal-500 transition-all duration-500 shadow-xl hover:shadow-emerald-500/20">
          <div className="bg-[#0f172a] rounded-[23px] p-8 md:p-12 h-full backdrop-blur-sm">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 flex items-center gap-4">
              <span className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl border border-emerald-500/30">
                💡
              </span>
              Why did you pick this idea to work on?
            </h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed font-light">
              <p>
                I didn't pick this idea from a pitch competition. I picked it from a salon chair in Karachi, on the day I was getting ready for my own wedding.
              </p>
              <p>
                Karachi is a city where beauty parlours and salons sit on every corner. That's not an exaggeration — approximately 560 weddings happen there in a single day. The demand is relentless. Yet when I spoke to business owners, they told me they'd stopped taking reservations. Why? <strong className="text-rose-400 font-medium">Because no-shows were bleeding them dry.</strong> A bride's party books five slots, only two show up. Chairs sit empty. Stylists stand idle. And the reliable customers get zero recognition — just the same wait, the same generic reminder, the same feeling that their time doesn't matter.
              </p>
              <p>
                I'm customer-obsessed. I've spent 8+ years in tech support — I know what it feels like when someone's time is wasted because a system failed them. So I asked: what if we could protect the business with a fair, risk-based deposit, and reward the customer for simply being reliable? A deposit that says <span className="italic">"we need assurance,"</span> paired with a reward that says <span className="italic">"we see you, and thank you."</span> That single idea — deposit for the business, reward for the customer — became Pabandi.
              </p>
              <p>
                From there, the vision expanded. If trust can be quantified and rewarded in a Karachi salon, why not in a Lahore clinic, an Islamabad freelancer's meeting, a Dubai restaurant, a London hotel? I realized this wasn't just a booking fix. <strong className="text-emerald-400 font-medium">It was a universal trust layer</strong> — a way to make every appointment, reservation, and handshake seamless and efficient because reliability finally had a score and a reward attached to it.
              </p>
              <p className="text-xl font-medium text-white italic border-l-4 border-emerald-500 pl-4 py-2 my-8">
                "I picked this idea because I saw it ruin people's days and businesses."
              </p>
              <p>
                I stayed with it because I had the technical skills to build the AI and Web3 infrastructure to fix it. And I'm obsessed with it because every check-in, every PAB token minted, every salon chair that stays filled is proof that promises deserve to be kept — and rewarded.
              </p>
            </div>
          </div>
        </div>

        {/* ── LIVE SELLING ASPECT ─────────────────────────────────────────────── */}
        <div ref={liveSellingRef} className="relative p-[1px] rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 shadow-2xl shadow-orange-500/20 transform transition-transform duration-500 hover:scale-[1.02]">
          <div className="bg-[#0f172a]/90 rounded-[23px] p-8 md:p-12 h-full backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-6 opacity-20">
              <svg className="w-24 h-24 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-6 flex items-center gap-4">
              <span className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl border border-amber-500/30">
                🎥
              </span>
              The Next Evolution: Live Selling
            </h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed font-light relative z-10">
              <p>
                Pabandi isn't just stopping at reservations. The service economy thrives on engagement, and we are integrating a <strong className="text-white font-medium">Live Selling and Social Commerce</strong> aspect into the core Pabandi experience.
              </p>
              <p>
                Imagine a salon owner demonstrating a new bridal makeup technique on a live stream, directly to an audience of highly reliable (high trust score) customers. Viewers can instantly book an appointment during the stream, locking in their spot with a smart deposit powered by Pabandi's escrow.
              </p>
              <p>
                This bridges the gap between digital discovery and physical fulfillment. Businesses can sell their time and services in real-time, leveraging their Pabandi reputation to convert viewers into verified, reliable bookings instantly. By combining Web3 trust mechanics with modern live-stream commerce, Pabandi will become the ultimate operating system for the service industry.
              </p>
            </div>
          </div>
        </div>

        {/* ── SOCIALS ─────────────────────────────────────────────────────────── */}
        <div ref={socialsRef} className="pt-16 pb-8 border-t border-slate-800 text-center">
          <h3 className="text-2xl font-semibold text-white mb-8">Connect with Pabandi</h3>
          
          <div className="flex flex-wrap justify-center gap-6">
            <a 
              href="https://www.linkedin.com/company/pabandi/" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-[#0a66c2]/10 hover:bg-[#0a66c2]/20 border border-[#0a66c2]/30 rounded-full text-[#0a66c2] hover:text-white transition-all duration-300"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              <span className="font-medium">LinkedIn</span>
            </a>

            <a 
              href="https://x.com/pabandiglobal" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-300 hover:text-white transition-all duration-300"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span className="font-medium">@pabandiglobal</span>
            </a>

            <a 
              href="https://instagram.com/pabandiglobal" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-400 hover:text-white transition-all duration-300"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              <span className="font-medium">pabandiglobal</span>
            </a>

            <a 
              href="https://wa.me/13124896967" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-full text-[#25D366] hover:text-white transition-all duration-300"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              <span className="font-medium">+1 (312) 489-6967</span>
            </a>
          </div>
        </div>

      </section>
    </div>
  );
}
