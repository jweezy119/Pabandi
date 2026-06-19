import { useLanguage } from '../context/LanguageContext';

export default function TermsOfServicePage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-headline font-bold text-on-surface mb-8">
        {t('Terms of Service & Compliance', 'Qawaneen aur Sharaait (Terms of Service)')}
      </h1>
      
      <p className="text-on-surface-variant font-body mb-8">
        {t(
          'Last Updated: June 2026. These terms govern your use of the Pabandi platform, APIs, and the $PAB utility token.',
          'Aakhri Update: June 2026. Yeh sharaait Pabandi platform, APIs, aur $PAB token ke istemal ko control karti hain.'
        )}
      </p>

      <div className="space-y-8 text-on-surface-variant font-body">
        
        {/* Section 1: General Use & Privacy (GDPR & PECA) */}
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('1. General Use, Privacy & Data Rights', '1. Aam Istemal, Privacy aur Data Rights')}
          </h2>
          <div className="space-y-4 text-lg">
            <p>
              {t(
                'By using Pabandi, you agree to our data practices outlined in the Privacy Policy. We adhere to the EU General Data Protection Regulation (GDPR) and the Pakistan Prevention of Electronic Crimes Act (PECA) 2016.',
                'Pabandi istemal karke, aap humari Privacy Policy se ittefaq karte hain. Hum EU GDPR aur Pakistan PECA 2016 ke mutabiq kaam karte hain.'
              )}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>{t('Right to Erasure (GDPR):', 'Data Delete Karne Ka Haq (GDPR):')}</strong>{' '}
                {t(
                  'You have the absolute right to request the deletion of your account and personal data at any time.',
                  'Aap kisi bhi waqt apna account aur zaati data delete karwane ka mukammal haq rakhte hain.'
                )}
              </li>
              <li>
                <strong>{t('Data Sovereignty (PECA):', 'Data Sovereignty (PECA):')}</strong>{' '}
                {t(
                  'Your data is securely stored and processed in compliance with local regulations. We do not sell your data to third parties.',
                  'Aapka data local qawaneen ke mutabiq mehfooz rakha jata hai. Hum aapka data kisi third-party ko nahi bechte.'
                )}
              </li>
            </ul>
          </div>
        </section>

        {/* Section 2: Communications (FCC / TCPA) */}
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('2. Communications & Messaging', '2. Rabtay aur Messages')}
          </h2>
          <p className="text-lg mb-4">
            {t(
              'To provide reliable booking services, Pabandi utilizes WhatsApp and SMS for transactional notifications (e.g., booking confirmations and reminders).',
              'Behtar booking service ke liye, Pabandi WhatsApp aur SMS ke zariye zaroori notifications (jaise booking confirmations aur reminders) bhejta hai.'
            )}
          </p>
          <div className="bg-surface-container p-4 rounded-lg border-l-4 border-primary">
            <p className="font-semibold text-on-surface">
              {t('TCPA / FCC Compliance (USA Users):', 'TCPA / FCC Qawaneen (USA Users):')}
            </p>
            <p className="mt-2 text-sm">
              {t(
                'By providing your phone number, you explicitly consent to receive transactional and informational messages from Pabandi and its partners. Standard message and data rates may apply. You may opt-out at any time by replying "STOP", though this may impact your ability to receive booking confirmations.',
                'Apna phone number faraham karke, aap Pabandi se zaroori messages wasool karne ki ijazat dete hain. Aap kisi bhi waqt "STOP" likh kar inkaar kar sakte hain.'
              )}
            </p>
          </div>
        </section>

        {/* Section 3: Web3 & Token Regulations (SEC & SBP) */}
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('3. Web3, $PAB Token & Financial Regulations', '3. Web3, $PAB Token aur Maali Qawaneen')}
          </h2>
          <div className="space-y-6 text-lg">
            <div>
              <h3 className="font-bold text-on-surface mb-2">
                {t('A. Classification as a Utility Token (USA SEC)', 'A. Utility Token Ki Hasiyat (USA SEC)')}
              </h3>
              <p>
                {t(
                  'The $PAB token is exclusively a utility and reward token designed to facilitate trustless escrows, loyalty rewards, and access to the Pabandi platform. $PAB is NOT an investment contract, security, or financial instrument under the rules of the US Securities and Exchange Commission (SEC). There is no expectation of profit.',
                  '$PAB token sirf ek utility aur inaami token hai. Yeh koi investment ya security nahi hai. Is se munafe ki umeed nahi rakhni chahiye.'
                )}
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-on-surface mb-2">
                {t('B. Digital Token Policy (State Bank of Pakistan)', 'B. Digital Token Policy (State Bank of Pakistan)')}
              </h3>
              <p>
                {t(
                  'In compliance with the State Bank of Pakistan (SBP), we explicitly state that $PAB is a digital reward voucher and is NOT recognized as legal tender or fiat currency in Pakistan. It is used strictly as a loyalty point system within the Pabandi application ecosystem.',
                  'State Bank of Pakistan (SBP) ke qawaneen ke mutabiq, $PAB ek digital inaami voucher hai aur ise Pakistan mein qanooni currency (fiat) tasleem nahi kiya jata. Yeh sirf Pabandi app ke andar loyalty points ke taur par istemal hota hai.'
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Solana Escrows & Finality */}
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            {t('4. Trustless Escrows & Smart Contracts', '4. Trustless Escrows aur Smart Contracts')}
          </h2>
          <p className="text-lg">
            {t(
              'Booking deposits are locked via decentralized smart contracts on the Solana blockchain. Transactions on the blockchain are final and immutable. Pabandi Technologies cannot reverse, refund, or modify a transaction once it has been executed by the smart contract rules (e.g., in the event of a verified no-show). You assume all risks associated with cryptographic systems.',
              'Booking deposits Solana blockchain par smart contracts ke zariye lock hote hain. Blockchain transactions aakhri aur na-qabil-e-tabdeel hoti hain. Ek baar smart contract execute ho jaye (jaise no-show ki soorat mein), Pabandi usay reverse ya refund nahi kar sakta.'
            )}
          </p>
        </section>

      </div>
    </div>
  );
}
