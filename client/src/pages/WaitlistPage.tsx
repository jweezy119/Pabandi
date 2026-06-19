import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, CheckCircleIcon, LanguageIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';

export const WaitlistPage: React.FC = () => {
  const { language, toggleLanguage, t } = useLanguage();
  const [count, setCount] = useState<number>(847);
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '+92',
    city: 'Karachi',
    cityOther: '',
    role: 'Customer',
    why: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Fetch live waitlist count
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/waitlist/count`)
      .then(res => res.json())
      .then(data => {
        if (data && data.count) {
          setCount(data.count);
        }
      })
      .catch(err => console.error('Failed to fetch count:', err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'whatsapp') {
      // Auto-format PK WhatsApp
      let formatted = value;
      if (!formatted.startsWith('+92')) {
        formatted = '+92' + formatted.replace(/[^0-9]/g, '');
      }
      setFormData(prev => ({ ...prev, whatsapp: formatted }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleSelect = (role: string) => {
    setFormData(prev => ({ ...prev, role }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setShowSuccess(true);
      } else {
        alert(t("Something went wrong. Please try again.", "Kuch ghalat ho gaya. Baraye meherbani dobara koshish karein."));
      }
    } catch (error) {
      console.error('Waitlist submission error:', error);
      alert(t("Network error. Please try again.", "Network error. Baraye meherbani dobara koshish karein."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#14F195] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#06b6d4] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl text-center">
          <CheckCircleIcon className="w-20 h-20 text-green-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#06b6d4]">
            {t("Welcome to Pabandi!", "Pabandi Mein Khush Aamdeed!")}
          </h2>
          <p className="text-gray-300 mb-8 text-lg">
            {t("Your spot on the waitlist is secured. 🎉", "Waitlist mein aap ki jagah mehfooz ho gayi hai. 🎉")}
          </p>
          
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-left">
            <h3 className="text-xl font-semibold mb-2 text-[#14F195]">
              {t("WhatsApp Group: Coming Soon! 🚧", "WhatsApp Group: Jald Aa Raha Hai! 🚧")}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {t(
                "Our admin is stuck in Karachi traffic (should've checked their driver's Pabandi score! 🛺💨). Drop your email and we'll notify you when the group opens.",
                "Hamara admin Karachi ki traffic mein phans gaya hai (unhein apnay driver ka Pabandi score check karna chahiye tha! 🛺💨). Apna email darj karein aur group khulnay par hum aap ko aagah kar denge."
              )}
            </p>
            
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); alert(t("Thanks! We'll keep you in the loop.", "Shukriya! Hum aap ko aagah rakhenge.")); }}>
              <input 
                type="email" 
                required
                placeholder={t("you@awesome.com", "aap@misali.com")}
                className="w-full bg-black/30 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:border-transparent transition-all"
              />
              <button 
                type="submit"
                className="w-full py-3 px-6 rounded-xl font-bold text-[#0f172a] bg-gradient-to-r from-[#14F195] to-[#06b6d4] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-[#14F195] transition-all shadow-[0_0_15px_rgba(20,241,149,0.3)]"
              >
                {t("Notify Me! 💌", "Mujhe Aagah Karein! 💌")}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 relative overflow-hidden flex flex-col items-center">
      {/* Animated Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-[#14F195] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-[#06b6d4] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className="absolute top-6 right-6 z-20 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 transition-all text-sm font-medium"
      >
        <LanguageIcon className="w-4 h-4" />
        {language === 'en' ? 'Urdu' : 'English'}
      </button>

      <div className="w-full max-w-2xl relative z-10 mt-8 mb-12">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          {t("Back to Home", "Home Par Wapis")}
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] via-emerald-400 to-[#06b6d4] drop-shadow-sm">
            {t("Promise, earn rewards 🇵🇰", "Wada karo, inaam pao 🇵🇰")}
          </h1>
          <p className="text-xl text-gray-300 max-w-xl mx-auto leading-relaxed">
            {t(
              "Pakistan's first reliability protocol. Show up → earn $PAB → build your on-chain reputation.",
              "Pakistan ka pehla reliability protocol. Time par aayen → $PAB kamayen → apni on-chain pehchaan banayen."
            )}
          </p>
        </div>

        {/* Counters */}
        <div className="flex justify-center gap-6 mb-12">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 text-center shadow-xl flex-1 max-w-[200px]">
            <div className="text-4xl font-bold text-white mb-1">{count.toLocaleString()}</div>
            <div className="text-sm text-gray-400 uppercase tracking-wider">
              {t("Founding Members", "Founding Members")}
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/40 to-cyan-900/40 backdrop-blur-lg border border-[#14F195]/30 rounded-2xl p-6 text-center shadow-[0_0_15px_rgba(20,241,149,0.2)] flex-1 max-w-[200px]">
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-emerald-400 mb-1">1,000</div>
            <div className="text-sm text-emerald-300 uppercase tracking-wider">
              {t("Spots Available", "Spots Available")}
            </div>
          </div>
        </div>

        {/* Waitlist Form */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl"></div>
          
          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  {t("Full Name", "Mukammal Naam")}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:border-transparent transition-all"
                  placeholder={t("Ali Khan", "Ali Khan")}
                />
              </div>
              
              <div>
                <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-300 mb-2">
                  {t("WhatsApp Number", "WhatsApp Number")}
                </label>
                <input
                  type="text"
                  id="whatsapp"
                  name="whatsapp"
                  required
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:border-transparent transition-all"
                  placeholder="+92 300 1234567"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t("Joining As", "Aap Ki Hesiyat")}
              </label>
              <div className="flex flex-wrap gap-3">
                {['Customer', 'Business Owner', 'Investor'].map(role => {
                  const roleLabel = role === 'Customer' ? t('Customer', 'Customer') : 
                                    role === 'Business Owner' ? t('Business Owner', 'Karobari') : 
                                    t('Investor', 'Investor');
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleSelect(role)}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                        formData.role === role 
                          ? 'bg-gradient-to-r from-[#14F195] to-[#06b6d4] text-[#0f172a] shadow-[0_0_10px_rgba(20,241,149,0.5)] border border-transparent' 
                          : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {roleLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-300 mb-2">
                  {t("Your City", "Aap Ka Shehar")}
                </label>
                <select
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:border-transparent transition-all appearance-none"
                >
                  <option value="Karachi">{t("Karachi", "Karachi")}</option>
                  <option value="Lahore">{t("Lahore", "Lahore")}</option>
                  <option value="Islamabad">{t("Islamabad", "Islamabad")}</option>
                  <option value="other">{t("Other...", "Deegar...")}</option>
                </select>
              </div>
              
              {formData.city === 'other' && (
                <div>
                  <label htmlFor="cityOther" className="block text-sm font-medium text-gray-300 mb-2">
                    {t("Specify City", "Shehar Ka Naam")}
                  </label>
                  <input
                    type="text"
                    id="cityOther"
                    name="cityOther"
                    required
                    value={formData.cityOther}
                    onChange={handleChange}
                    className="w-full bg-black/30 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:border-transparent transition-all"
                    placeholder={t("E.g. Rawalpindi", "Mislan Rawalpindi")}
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="why" className="block text-sm font-medium text-gray-300 mb-2">
                {t("Why Pabandi? (Optional)", "Pabandi Kyun? (Optional)")}
              </label>
              <textarea
                id="why"
                name="why"
                rows={3}
                value={formData.why}
                onChange={handleChange}
                className="w-full bg-black/30 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:border-transparent transition-all resize-none"
                placeholder={t("What excites you about building a reliable Pakistan?", "Aik qabil-e-bharosa Pakistan bananay mein aap ko kya cheez mutasir karti hai?")}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-xl text-lg font-bold text-[#0f172a] bg-gradient-to-r from-[#14F195] via-emerald-400 to-[#06b6d4] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-[#14F195] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(20,241,149,0.4)] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? t("Securing Spot...", "Spot Book Ho Raha Hai...") : t("Join the Founding 1,000 →", "Founding 1,000 Mein Shamil Hon →")}
            </button>
          </form>
        </div>
      </div>
      
      {/* Custom styles for animations since they might not be in tailwind.config.js */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};
