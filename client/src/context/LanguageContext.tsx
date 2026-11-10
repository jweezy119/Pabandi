import React, { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type Language = 'EN' | 'UR' | 'en' | 'ur';

export interface LanguageContextType {
  language: 'EN' | 'UR';
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (en: string, ur?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t: i18nTranslate, i18n } = useTranslation();

  const [currentLang, setCurrentLang] = useState<'EN' | 'UR'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pabandi_language');
      if (saved === 'UR' || saved === 'ur') return 'UR';
    }
    const initial = i18n.language?.toUpperCase();
    return initial === 'UR' ? 'UR' : 'EN';
  });

  const isRTL = currentLang === 'UR';

  // Apply RTL direction and language attributes to the root document
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = currentLang.toLowerCase();
      localStorage.setItem('pabandi_language', currentLang);
    }
  }, [currentLang, isRTL]);

  const setLanguage = useCallback((lang: Language) => {
    const normalized = lang.toUpperCase() === 'UR' ? 'UR' : 'EN';
    setCurrentLang(normalized);
    i18n.changeLanguage(normalized.toLowerCase());
  }, [i18n]);

  const toggleLanguage = useCallback(() => {
    setLanguage(currentLang === 'EN' ? 'UR' : 'EN');
  }, [currentLang, setLanguage]);

  const t = useCallback((en: string, ur?: string) => {
    if (currentLang === 'UR' && ur) {
      return ur;
    }
    if (currentLang === 'EN') {
      return en;
    }
    return ur || i18nTranslate(en) || en;
  }, [currentLang, i18nTranslate]);

  return (
    <LanguageContext.Provider value={{ language: currentLang, isRTL, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
