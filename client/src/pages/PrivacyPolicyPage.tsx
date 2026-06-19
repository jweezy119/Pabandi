import { useLanguage } from '../context/LanguageContext';

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-headline font-bold text-on-surface mb-8">
        {t('Privacy & Data Sovereignty', 'Privacy aur Data Sovereignty')}
      </h1>

      <div className="space-y-8 text-on-surface-variant font-body">
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('1. WhatsApp Messages', '1. WhatsApp Messages')}
          </h2>
          <p className="text-lg">
            {t(
              'We never store your WhatsApp messages. We only use WhatsApp to send booking confirmations and reminders. Your conversations remain entirely private.',
              'Hum kabhi bhi aapke WhatsApp messages save nahi karte. Hum sirf booking confirmations aur reminders bhejney ke liye WhatsApp use karte hain. Aapki baatein bilkul private rehti hain.'
            )}
          </p>
        </section>

        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('2. Social Connections', '2. Social Connections')}
          </h2>
          <p className="text-lg">
            {t(
              'Your social connections (LinkedIn, Meta, Fiverr) are hashed. We don’t see or store your posts, friends list, or private data. We only use account age and public star ratings to give you a trust bonus.',
              'Aapke social connections hashed hote hain. Hum aapki posts ya private data nahi dekhte. Hum sirf account ki age aur public rating check karte hain taake aapko trust bonus mil sake.'
            )}
          </p>
        </section>

        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('3. Data Control', '3. Data Control')}
          </h2>
          <p className="text-lg">
            {t(
              'Your data is yours. You can delete your account and all associated data at any time from your profile settings. Once deleted, it cannot be recovered.',
              'Aapka data sirf aapka hai. Aap kisi bhi waqt apna account aur sara data delete kar sakte hain. Delete hone ke baad data wapis recover nahi ho sakta.'
            )}
          </p>
        </section>

        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('4. Data Security & Hosting', '4. Data Security')}
          </h2>
          <p className="text-lg">
            {t(
              'Your data is encrypted at rest and never sold to third parties. Our servers are secured and we are actively working towards hosting data in localized regions close to Pakistan for maximum data sovereignty.',
              'Aapka data encrypted hai aur kabhi kisi third-party ko sell nahi kiya jata. Humara system secure hai aur hum Pakistan ke qareeb servers host karne par kaam kar rahe hain.'
            )}
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-on-surface mb-6">
            {t('How Your Data Moves', 'Aapka Data Kese Flow Karta Hai')}
          </h2>
          <div className="p-8 bg-surface-container rounded-xl border border-outline-variant/30 flex flex-col md:flex-row items-center justify-center gap-6">
            
            <div className="flex flex-col items-center bg-surface-container-highest p-6 rounded-lg text-center w-full md:w-1/3">
              <span className="material-symbols-outlined text-4xl text-primary mb-3">smartphone</span>
              <h3 className="font-bold text-on-surface">Your Phone</h3>
              <p className="text-sm mt-2">{t('Only GPS Coordinate + Timestamp', 'Sirf GPS location aur time')}</p>
            </div>

            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl md:rotate-[-90deg]">arrow_drop_down_circle</span>
            </div>

            <div className="flex flex-col items-center bg-surface-container-highest p-6 rounded-lg text-center w-full md:w-1/3">
              <span className="material-symbols-outlined text-4xl text-[#14F195] mb-3">dns</span>
              <h3 className="font-bold text-on-surface">Pabandi Server</h3>
              <p className="text-sm mt-2">{t('Encrypted & Verified Check-in', 'Encrypted check-in verification')}</p>
            </div>

          </div>
          <p className="text-sm text-center text-on-surface-variant mt-4">
            {t('No constant tracking. We only verify your location at the exact time of your appointment.', 'Hum lagatar tracking nahi karte. Sirf appointment ke waqt location verify hoti hai.')}
          </p>
        </section>
      </div>
    </div>
  );
}
