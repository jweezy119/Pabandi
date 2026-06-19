import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'en' | 'ur';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  // We keep `t` here for backwards compatibility if needed, 
  // but it's recommended to use `useTranslation` directly in components.
  t: (en: string, ur?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { t: i18nTranslate, i18n } = useTranslation();

  const language = (i18n.language === 'en' || i18n.language === 'ur') ? (i18n.language as Language) : 'en';

  const setLanguage = useCallback((lang: Language) => {
    i18n.changeLanguage(lang);
  }, [i18n]);

  const toggleLanguage = useCallback(() => {
    i18n.changeLanguage(language === 'en' ? 'ur' : 'en');
  }, [i18n, language]);

  // Backwards compatible `t` function
  // If `ur` is provided, it acts like the old manual translation function.
  // If not, it uses i18next translation key.
  const t = useCallback((en: string, ur?: string) => {
    if (ur) {
      return language === 'en' ? en : ur;
    }
    return i18nTranslate(en);
  }, [language, i18nTranslate]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
