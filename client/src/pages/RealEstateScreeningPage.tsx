import { useParams, Link } from 'react-router-dom';
import ScreeningCard from '../components/ScreeningCard';

export default function RealEstateScreeningPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 16px', fontFamily: 'var(--font, inherit)' }}>
      <Link to="/hospitality" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
        ← Back to Hospitality
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)', marginTop: 12 }}>
        Real-Estate Court Screening
      </h1>
      <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 6 }}>
        Each booking can be screened against U.S. court records. The risk band (LOW / MEDIUM / HIGH)
        automatically adjusts the security-deposit requirement — feeding the Pabandi trust rail.
      </p>
      {reservationId ? (
        <div style={{ marginTop: 24 }}>
          <ScreeningCard reservationId={reservationId} />
        </div>
      ) : (
        <div style={{ marginTop: 24, padding: 20, borderRadius: 14, background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)', color: 'var(--muted-foreground)' }}>
          No reservation specified. Open <code>/real-estate/screening/&lt;reservationId&gt;</code> to screen a booking.
        </div>
      )}
    </div>
  );
}
