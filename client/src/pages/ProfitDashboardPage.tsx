export default function ProfitDashboardPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F5EFE6', padding: '2rem', textAlign: 'center' }}>
      <div style={{ maxWidth: 600, margin: '4rem auto' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', color: '#2A2520', marginBottom: '1rem' }}>Profit Dashboard</h1>
        <p style={{ color: '#BFB3A3', marginBottom: '2rem' }}>
          Track revenue, expenses, and payroll across your business.
        </p>
        <a href="/crm" style={{ display: 'inline-block', background: '#C97B5A', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 12, textDecoration: 'none', fontWeight: 600 }}>
          Go to CRM Dashboard →
        </a>
      </div>
    </div>
  );
}
