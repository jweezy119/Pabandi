export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-headline font-bold text-on-surface mb-8">
        Privacy & Data Sovereignty
      </h1>

      <div className="space-y-8 text-on-surface-variant font-body">
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            1. WhatsApp Messages
          </h2>
          <p className="text-lg">
            We never store your WhatsApp messages. We only use WhatsApp to send booking confirmations and reminders. Your conversations remain entirely private.
          </p>
        </section>

        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            2. Social Connections
          </h2>
          <p className="text-lg">
            Your social connections (LinkedIn, Meta, Fiverr) are hashed. We don’t see or store your posts, friends list, or private data. We only use account age and public star ratings to give you a trust bonus.
          </p>
        </section>

        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            3. Data Control
          </h2>
          <p className="text-lg">
            Your data is yours. You can delete your account and all associated data at any time from your profile settings. Once deleted, it cannot be recovered.
          </p>
        </section>

        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            4. Data Security & Hosting
          </h2>
          <p className="text-lg">
            Your data is encrypted at rest and never sold to third parties. Our servers are secured and globally distributed for maximum data sovereignty and reliability.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-on-surface mb-6">
            How Your Data Moves
          </h2>
          <div className="p-8 bg-surface-container rounded-xl border border-outline-variant/30 flex flex-col md:flex-row items-center justify-center gap-6">
            
            <div className="flex flex-col items-center bg-surface-container-highest p-6 rounded-lg text-center w-full md:w-1/3">
              <span className="material-symbols-outlined text-4xl text-primary mb-3">smartphone</span>
              <h3 className="font-bold text-on-surface">Your Phone</h3>
              <p className="text-sm mt-2">Only GPS Coordinate + Timestamp</p>
            </div>

            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl md:rotate-[-90deg]">arrow_drop_down_circle</span>
            </div>

            <div className="flex flex-col items-center bg-surface-container-highest p-6 rounded-lg text-center w-full md:w-1/3">
              <span className="material-symbols-outlined text-4xl text-[#14F195] mb-3">dns</span>
              <h3 className="font-bold text-on-surface">Pabandi Server</h3>
              <p className="text-sm mt-2">Encrypted & Verified Check-in</p>
            </div>

          </div>
          <p className="text-sm text-center text-on-surface-variant mt-4">
            No constant tracking. We only verify your location at the exact time of your appointment.
          </p>
        </section>
      </div>
    </div>
  );
}
