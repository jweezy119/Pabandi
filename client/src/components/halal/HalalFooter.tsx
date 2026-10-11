import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

type HalalFooterProps = {
  className?: string;
};

export const HalalFooter: React.FC<HalalFooterProps> = ({ className = '' }) => {
  const { language } = useLanguage();

  return (
    <div className={`border-t border-white/8 bg-white/[0.02] px-4 py-6 ${className}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">🛡️</span>
            <div>
              <p className="text-xs font-bold text-white/80">
                {language === 'en' ? 'Sharia-Compliant by Design' : 'Sharia ke mutabiq tayar karda'}
              </p>
              <p className="text-[10px] text-white/40">
                {language === 'en'
                  ? 'No Riba · No Gharar · No Maysir · Profit-sharing from real economic activity'
                  : 'Koi Riba nahi · Koi Gharar nahi · Koi Maysir nahi · Haqeeqi economic activity se profit-sharing'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/sharia-compliance"
              className="text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors"
            >
              {language === 'en' ? 'Sharia Compliance' : 'Sharia Compliance'}
            </Link>
            <Link
              to="/sharia-transparency"
              className="text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors"
            >
              {language === 'en' ? 'Transparency' : 'Transparency'}
            </Link>
            <Link
              to="/mudarabah"
              className="text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors"
            >
              {language === 'en' ? 'Mudarabah Pools' : 'Mudarabah Pools'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HalalFooter;
