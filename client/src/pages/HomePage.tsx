import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService } from '../services/api';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';

// Haversine distance calculation (in km)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
};

export default function HomePage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const { t } = useLanguage();

  // Debounce search input to query as user types without overloading server
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchInput]);

  const { data, isLoading } = useQuery(
    ['businesses', category, searchQuery, userLoc],
    async () => {
      const params: any = {
        category: category !== 'ALL' ? category : undefined,
        search: searchQuery || undefined
      };
      if (userLoc) {
        params.latitude = userLoc.lat;
        params.longitude = userLoc.lng;
      }
      const res = await businessService.getPublicBusinesses(params);
      return res.data?.data?.businesses || [];
    },
    { keepPreviousData: true }
  );

  let businesses = data || [];

  if (userLoc) {
    businesses = [...businesses].sort((a, b) => {
      const distA = getDistance(userLoc.lat, userLoc.lng, a.latitude || 24.86, a.longitude || 67.00);
      const distB = getDistance(userLoc.lat, userLoc.lng, b.latitude || 24.86, b.longitude || 67.00);
      return distA - distB;
    });
  }

  const handleGetLocation = () => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      (err) => {
        console.error("Location access denied or failed", err);
        setLocLoading(false);
      }
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const categories = ['ALL', 'RESTAURANT', 'SPA', 'CLINIC', 'FITNESS_CENTER', 'SALON'];
  const getCategoryLabel = (c: string) => {
    if (c === 'ALL') return 'All Categories';
    if (c === 'RESTAURANT') return 'Fine Dining';
    if (c === 'FITNESS_CENTER') return 'Fitness';
    return c.charAt(0) + c.slice(1).toLowerCase();
  };

  return (
    <div className="w-full pb-28 md:pb-10 font-body">
      
      {/* NEW HERO SECTION */}
      <section className="relative w-full bg-[#0f172a] text-white overflow-hidden py-24 md:py-32 border-b border-slate-800">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
          
          {/* Animated glowing orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#14F195] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#06b6d4] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
        </div>

        {/* Blurred Neon Map Background */}
        <div className="absolute inset-0 opacity-[0.15] pointer-events-none flex items-center justify-center">
           <svg viewBox="0 0 800 800" className="w-full h-full object-cover blur-[2px]">
             {/* Abstract Map Dots representing Pakistan */}
             <g fill="rgba(20,241,149,0.6)">
               <circle cx="300" cy="400" r="4" className="animate-pulse" />
               <circle cx="350" cy="350" r="3" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
               <circle cx="450" cy="200" r="5" className="animate-pulse" style={{ animationDelay: '1s' }} />
               <circle cx="500" cy="500" r="4" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
               <circle cx="400" cy="600" r="6" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
               <circle cx="200" cy="300" r="4" className="animate-pulse" style={{ animationDelay: '0.8s' }} />
             </g>
             {/* Glowing connecting lines */}
             <path d="M300 400 L350 350 L450 200 L500 500 L400 600 Z" stroke="rgba(6,182,212,0.3)" strokeWidth="1" fill="none" />
           </svg>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          {/* Left Col - Copy */}
          <div className="flex-1 space-y-8">
            <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tight leading-[1.1]">
              {t("Your Reliability", "Aapki Pabandi")} <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#06b6d4]">{t("Finally Pays.", "Ab Faida Degi.")}</span>
              <br/>
              <span className="italic text-slate-400 font-medium">{t("Literally.", "Haqeeqat Mein.")}</span>
            </h1>
            <p className="font-body text-xl text-slate-300 leading-relaxed max-w-xl">
              {t("A high Pabandi Score means zero deposits. Every booking you honor mints", "Pabandi Score zyada hone ka matlab zero deposits. Har poori ki gayi booking se kamayein")} <span className="font-bold text-pink-400">$PAB</span> {t("to your wallet. And businesses get paid for trusting you. Good customers just became the VIPs they always deserved to be.", "seedha apne wallet mein. Achay customers ab VIPs hain.")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <div className="group relative">
                <button className="relative w-full sm:w-auto px-8 py-4 bg-white text-[#0f172a] font-bold rounded-xl shadow-[0_0_20px_rgba(20,241,149,0.3)] hover:shadow-[0_0_30px_rgba(20,241,149,0.5)] transition-all overflow-hidden flex items-center justify-center gap-2">
                  <span className="absolute inset-0 w-full h-full border-[2px] border-transparent group-hover:border-[#14F195] transition-colors rounded-xl"></span>
                  <span className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#14F195] to-transparent -translate-x-full group-hover:animate-[slideRight_1.5s_infinite]"></span>
                  {t("Start Earning $PAB", "$PAB Kamana Shuru Karein")}
                </button>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg whitespace-nowrap pointer-events-none">
                  {t("Connect your wallet and let your reliability do the rest.", "Apna wallet connect karein aur faida uthayein.")}
                </div>
              </div>
              <button className="px-8 py-4 border border-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                {t("How It Works", "Ye Kaise Kaam Karta Hai")} <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Right Col - Visual Concept (Gauge + Cards) */}
          <div className="flex-1 relative w-full aspect-square max-w-md mx-auto">
            {/* The Gauge */}
            <div className="absolute inset-0 flex items-center justify-center">
               <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                 {/* Background Arc */}
                 <path d="M40 160 A 85 85 0 1 1 160 160" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeLinecap="round" />
                 {/* Foreground Arc (Animated) */}
                 <path d="M40 160 A 85 85 0 1 1 160 160" fill="none" stroke="url(#cyanMintGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="400" strokeDashoffset="400" className="animate-[fillGauge_2s_ease-out_forwards]" />
                 <defs>
                   <linearGradient id="cyanMintGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                     <stop offset="0%" stopColor="#06b6d4" />
                     <stop offset="100%" stopColor="#14F195" />
                   </linearGradient>
                 </defs>
                 <text x="100" y="110" textAnchor="middle" fill="white" fontSize="42" fontWeight="900" className="font-headline">91</text>
                 <text x="100" y="135" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600" className="font-body uppercase tracking-widest">{t("Reliability", "Pabandi")}</text>
               </svg>
            </div>

            {/* Floating Glass Cards */}
            <div className="absolute top-[15%] -left-[10%] bg-white/5 backdrop-blur-xl border border-white/10 p-3 rounded-lg shadow-xl animate-[float_6s_ease-in-out_infinite]">
               <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{t("Base Reward", "Base Inaam")}</div>
               <div className="text-lg text-[#14F195] font-bold">+50 PAB</div>
            </div>

            <div className="absolute bottom-[25%] -right-[10%] bg-white/5 backdrop-blur-xl border border-white/10 p-3 rounded-lg shadow-xl animate-[float_5s_ease-in-out_infinite_reverse]">
               <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{t("Multiplier", "Multiplier")}</div>
               <div className="text-lg text-[#06b6d4] font-bold">x1.2 {t("Reliability", "Pabandi")}</div>
            </div>

            {/* Falling $PAB coins */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
               <div className="absolute w-4 h-4 bg-gradient-to-tr from-[#14F195] to-emerald-400 rounded-full blur-[1px] animate-[fall_3s_linear_infinite] left-[20%] top-[-10%] shadow-[0_0_10px_rgba(20,241,149,0.8)]"></div>
               <div className="absolute w-3 h-3 bg-gradient-to-tr from-[#14F195] to-emerald-400 rounded-full blur-[1px] animate-[fall_4s_linear_infinite] left-[70%] top-[-10%] delay-700 shadow-[0_0_10px_rgba(20,241,149,0.8)]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ORIGINAL APP CONTENT - App Directory, Searching, Near You */}
      <div className="max-w-5xl mx-auto px-6 md:px-8 space-y-12 mt-16">
        
        {/* Search Bar & Categories */}
        <section className="space-y-6">
          <div className="text-center mb-8">
             <h2 className="font-headline text-3xl font-bold text-on-surface">{t("Explore Pakistan's Best Spots", "Pakistan Ki Behtareen Jaghein Daryaft Karein")}</h2>
          </div>
          <form onSubmit={handleSearch} className="bg-surface-container-low rounded-lg flex items-center px-4 py-3 group focus-within:bg-surface-container-lowest focus-within:outline focus-within:outline-1 focus-within:outline-outline-variant/20 transition-all duration-300 shadow-sm max-w-2xl mx-auto">
            <span className="material-symbols-outlined text-outline mr-3">search</span>
            <input 
              className="bg-transparent border-none focus:ring-0 w-full font-body text-sm text-on-surface placeholder-outline font-medium focus:outline-none" 
              placeholder={t("Find places, categories, or services...", "Jaghein, categories ya services talash karein...")} 
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-1.5 rounded text-sm font-body font-medium ml-2 shadow-[0_4px_12px_rgba(1,29,53,0.15)] hover:shadow-lg transition-shadow">
              {t("Search", "Talash Karein")}
            </button>
          </form>
          
          {/* Category Filters */}
          <div className="flex justify-center overflow-x-auto gap-3 no-scrollbar pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`${
                  category === c 
                    ? 'bg-primary text-on-primary shadow-[0_8px_16px_rgba(1,29,53,0.08)]' 
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container-highest'
                } px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap transition-colors`}
              >
                {getCategoryLabel(c)}
              </button>
            ))}
          </div>
        </section>

      {/* Featured Businesses */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
            {userLoc ? t('Near You', 'Aap Ke Qareeb') : t('Curated for You', 'Aap Ke Liye')}
          </h3>
          <button 
            onClick={handleGetLocation} 
            disabled={locLoading}
            className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            <MapPinIcon className="h-4 w-4" />
            {locLoading ? t('Locating...', 'Talash Jaari...') : t('Near Me', 'Mere Qareeb')}
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-low rounded-xl">
            <p className="font-body text-on-surface-variant">No businesses found matching your criteria.</p>
            <button onClick={() => { setSearchInput(''); setSearchQuery(''); setCategory('ALL'); }} className="mt-4 text-primary font-bold hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Main Feature - First Business */}
            {businesses[0] && (
              <Link target="_blank" rel="noopener noreferrer" to={`/business/${businesses[0].id}`} className="md:col-span-8 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] group relative h-80 block tile-hover border border-outline-variant/10 glowing-border">
                <img 
                  alt={businesses[0].name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  src={businesses[0].coverImageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200"} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6 w-full z-10">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {getCategoryLabel(businesses[0].category)}
                    </span>
                    <span className="flex items-center text-on-primary text-sm font-body">
                      <span className="material-symbols-outlined text-[16px] mr-1 text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      {businesses[0].rating?.toFixed(1) || '4.9'}
                    </span>
                    {businesses[0].isClaimed ? (
                      <span className="bg-[#14F195]/20 text-[#14F195] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-label border border-[#14F195]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse"></span>
                        Solana Protected
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-[#fbbf24] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-label border border-[#f59e0b]/30">
                        Unclaimed Listing
                      </span>
                    )}
                  </div>
                  <h4 className="font-headline text-2xl font-bold text-on-primary mb-1">{businesses[0].name}</h4>
                  <p className="font-body text-slate-300 text-sm max-w-md line-clamp-2">
                    {businesses[0].description || `${businesses[0].city} • Discover our premium services.`}
                  </p>
                </div>
              </Link>
            )}
            
            {/* Secondary Stack - Next Two Businesses */}
            <div className="md:col-span-4 flex flex-col gap-6">
              {businesses[1] && (
                <Link target="_blank" rel="noopener noreferrer" to={`/business/${businesses[1].id}`} className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] flex-1 relative group block min-h-[150px] tile-hover border border-outline-variant/10 glowing-border">
                  <img 
                    alt={businesses[1].name} 
                    className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" 
                    src={businesses[1].coverImageUrl || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600"} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
                  <div className="absolute top-4 right-4 z-10">
                    {businesses[1].isClaimed ? (
                      <span className="bg-[#14F195]/30 backdrop-blur-md text-[#14F195] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-[#14F195]/40">
                        Solana
                      </span>
                    ) : (
                      <span className="bg-amber-500/30 backdrop-blur-md text-[#fbbf24] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[#f59e0b]/40">
                        Unclaimed
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 p-5 z-10">
                    <span className="bg-secondary-container text-on-secondary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                      {getCategoryLabel(businesses[1].category)}
                    </span>
                    <h4 className="font-headline text-lg font-bold text-on-primary">{businesses[1].name}</h4>
                  </div>
                </Link>
              )}
              
              {businesses.length > 2 ? (
                businesses[2] && (
                  <Link target="_blank" rel="noopener noreferrer" to={`/business/${businesses[2].id}`} className="bg-surface-container-low rounded-xl overflow-hidden flex-1 p-5 flex flex-col justify-center min-h-[150px] cursor-pointer group hover:bg-surface-container transition-colors shadow-sm tile-hover border border-outline-variant/10 glowing-border">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-headline text-lg font-bold text-on-surface">{businesses[2].name}</h4>
                      {businesses[2].isClaimed ? (
                        <span className="bg-[#14F195]/20 text-[#10b981] px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-[#14F195]/30">Solana</span>
                      ) : (
                        <span className="bg-amber-500/20 text-[#d97706] px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-[#f59e0b]/30">Unclaimed</span>
                      )}
                    </div>
                    <p className="font-body text-on-surface-variant text-sm mb-4 line-clamp-2">
                      {businesses[2].description || `Located in ${businesses[2].city}. Explore our offerings.`}
                    </p>
                    <button className="flex items-center text-primary font-body text-sm font-semibold group-hover:gap-2 transition-all">
                      Explore <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
                    </button>
                  </Link>
                )
              ) : (
                <div className="bg-surface-container-low rounded-xl overflow-hidden flex-1 p-5 flex flex-col justify-center min-h-[150px] cursor-pointer group hover:bg-surface-container transition-colors">
                  <h4 className="font-headline text-lg font-bold text-on-surface mb-2">More coming soon</h4>
                  <p className="font-body text-on-surface-variant text-sm mb-4">New businesses are registering in your area every day.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </section>

      {/* Technology Promo Banner */}
      <section className="bg-primary/5 rounded-3xl p-8 md:p-12 border border-primary/10 flex flex-col md:flex-row items-center gap-8 justify-between shadow-sm tile-hover glowing-border">
        <div className="max-w-xl space-y-4">
          <div className="flex items-center gap-2 text-primary font-label text-sm font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">memory</span>
            Breakthrough Technology
          </div>
          <h3 className="font-headline text-3xl font-bold text-on-surface">Experience No-Show Proof Bookings</h3>
          <p className="font-body text-on-surface-variant text-lg">
            Our proprietary AI risk engine evaluates reliability in real-time, building your personalized Pabandi Score. Book at top-tier venues with zero deposit when you maintain a high score, all powered by the Solana blockchain.
          </p>
          <div className="pt-2">
            <Link to="/technology" className="text-primary font-semibold hover:underline flex items-center gap-1">
              Learn how it works <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </div>
        <div className="w-full md:w-auto flex-shrink-0 relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
          <div className="relative bg-surface-container-highest p-6 rounded-2xl shadow-lg border border-outline-variant/20 flex flex-col items-center">
            <div className="text-sm font-label uppercase tracking-widest text-on-surface-variant mb-2">Your Pabandi Score</div>
            <div className="text-5xl font-headline font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#38bdf8]">
              850
            </div>
            <div className="mt-2 text-xs font-bold bg-[#14F195]/20 text-[#10b981] px-2 py-1 rounded-md uppercase">Elite Status</div>
          </div>
        </div>
      </section>

      {/* Social Trust Layer Promo */}
      <section className="rounded-3xl overflow-hidden border border-outline-variant/10 relative" style={{ background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(99,102,241,0.12) 0%, transparent 60%)' }} />
        <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#818cf8' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              NEW — SECTION 6.4
            </div>
            <h3 className="font-headline text-2xl md:text-3xl font-bold" style={{ color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              Your Reputation Travels With You
            </h3>
            <p className="text-base leading-relaxed" style={{ color: '#94a3b8', maxWidth: '480px' }}>
              Link your LinkedIn, Fiverr, or Upwork account. Earn a cross-platform trust boost, unlock zero-deposit bookings, and share your Pabandi Reliability Badge everywhere your reputation matters.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/trust"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}
              >
                Explore Trust Layer →
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0' }}
              >
                Connect Accounts
              </Link>
            </div>
          </div>
          {/* Platform pill badges */}
          <div className="flex flex-col gap-3 shrink-0">
            {[
              { emoji: '💼', name: 'LinkedIn', boost: '+5 pts', color: '#0A66C2' },
              { emoji: '🟢', name: 'Fiverr', boost: '+8 pts', color: '#1DBF73' },
              { emoji: '🔵', name: 'Upwork', boost: '+8 pts', color: '#14A800' },
              { emoji: '🐦', name: 'X / Truth Social', boost: '+3 pts', color: '#818cf8' },
            ].map(p => (
              <div key={p.name} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-lg">{p.emoji}</span>
                <span className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{p.name}</span>
                <span className="text-xs font-bold ml-auto px-2 py-0.5 rounded-full" style={{ background: p.color + '20', color: p.color }}>{p.boost}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Rated Institutions */}
      {businesses.length > 3 && (
        <section className="space-y-6">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">More Top Rated Places</h3>
          <div className="space-y-4">
            {businesses.slice(3).map((biz: any) => (
              <Link target="_blank" rel="noopener noreferrer" key={biz.id} to={`/business/${biz.id}`} className="bg-surface-container-lowest rounded-xl p-4 flex items-center justify-between shadow-[0_10px_20px_rgba(1,29,53,0.03)] group hover:bg-surface-container-lowest/80 border border-outline-variant/10 tile-hover glowing-border transition-all duration-300">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-highest relative">
                    {biz.logoUrl || biz.coverImageUrl ? (
                      <img alt={biz.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={biz.logoUrl || biz.coverImageUrl} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant font-headline font-bold text-2xl">
                        {biz.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-headline text-lg font-bold text-on-surface">{biz.name}</h4>
                      {biz.isClaimed ? (
                        <span className="bg-[#14F195]/20 text-[#10b981] px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-[#14F195]/30">Solana Protected</span>
                      ) : (
                        <span className="bg-amber-500/20 text-[#d97706] px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-[#f59e0b]/30">Unclaimed</span>
                      )}
                    </div>
                    <p className="font-body text-on-surface-variant text-sm mb-3">
                      {biz.address}, {biz.city}
                    </p>
                    <div className="flex gap-2">
                      <span className="font-label text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded uppercase">
                        {getCategoryLabel(biz.category)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mr-4">
                  <span className="flex items-center text-on-surface font-body font-semibold text-sm bg-surface-container px-2 py-1 rounded">
                    <span className="material-symbols-outlined text-[16px] text-[#f59e0b] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    {biz.rating?.toFixed(1) || '4.8'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      </div>
    </div>
  );
}
