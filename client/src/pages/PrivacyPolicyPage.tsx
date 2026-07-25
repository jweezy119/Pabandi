import { tokens } from '../design-system';

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <h1 className="font-headline mb-8 text-4xl font-bold text-on-surface">
        Privacy & Data Sovereignty
      </h1>

      <div className="font-body space-y-8" style={{ color: tokens.color.muted }}>

        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            1. WhatsApp Messages
          </h2>
          <p className="font-body text-lg">
            We never store your WhatsApp messages. We only use WhatsApp to send booking confirmations and reminders. Your conversations remain entirely private.
          </p>
        </section>

        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            2. Social Connections
          </h2>
          <p className="font-body text-lg">
            Your social connections are hashed. We don’t see or store your posts, friends list, or private data. We only use account age and public signals to give you a trust bonus.
          </p>
        </section>

        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            3. Data Control
          </h2>
          <p className="font-body text-lg">
            Your data is yours. You can delete your account and all associated data at any time from your profile settings. Once deleted, it cannot be recovered.
          </p>
        </section>

        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            4. Data Security & Hosting
          </h2>
          <p className="font-body" style={{ color: tokens.color.muted }}>
            Your data is encrypted at rest and never sold to third parties. Our servers are secured and globally distributed for maximum data sovereignty and reliability.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-headline mb-6 text-2xl font-bold text-on-surface">
            How Your Data Moves
          </h2>
          <div className="flex flex-col items-center justify-center gap-6 rounded-xl border p-8 md:flex-row" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
            <div className="flex w-full flex-col items-center rounded-lg p-6 text-center md:w-1/3" style={{ background: tokens.color.background }}>
              <div className="mb-3 text-4xl">📱</div>
              <h3 className="font-bold text-on-surface">Your Phone</h3>
              <p className="mt-2 text-sm" style={{ color: tokens.color.muted }}>Only GPS Coordinate + Timestamp</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="text-3xl md:-rotate-90" style={{ color: tokens.color.muted }}>→</div>
            </div>

            <div className="flex w-full flex-col items-center rounded-lg p-6 text-center md:w-1/3" style={{ background: tokens.color.background }}>
              <div className="mb-3 text-4xl" style={{ color: tokens.color.success }}>🖥️</div>
              <h3 className="font-bold text-on-surface">Pabandi Server</h3>
              <p className="mt-2 text-sm" style={{ color: tokens.color.muted }}>Encrypted & Verified Check-in</p>
            </div>
          </div>
          <p className="mt-4 text-center text-sm" style={{ color: tokens.color.muted }}>
            No constant tracking. We only verify your location at the exact time of your appointment.
          </p>
        </section>
      </div>
    </div>
  );
}
