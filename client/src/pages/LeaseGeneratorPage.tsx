import { useState, useEffect, FormEvent } from "react";

const API_BASE = `${import.meta.env.VITE_API_URL || "https://pabandi.onrender.com"}/api/v1/property-manager`;
const STEPS = ["Property & Tenant", "Lease Terms", "Clauses", "Review", "Sign & Send"] as const;

interface Property {
  id: string;
  name: string;
  address: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
}

interface LeaseData {
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  rent_period: "monthly" | "weekly" | "annually";
  security_deposit: number;
  pet_fee: number;
  pet_monthly_fee: number;
  late_fee: number;
  grace_period_days: number;
  utilities_included: string[];
  renewal_terms: string;
  termination_notice_days: number;
  special_provisions: string;
}

const initialLease: LeaseData = {
  property_id: "",
  tenant_id: "",
  start_date: "",
  end_date: "",
  rent_amount: 0,
  rent_period: "monthly",
  security_deposit: 0,
  pet_fee: 0,
  pet_monthly_fee: 0,
  late_fee: 0,
  grace_period_days: 5,
  utilities_included: [],
  renewal_terms: "Month-to-month renewal unless otherwise specified in writing.",
  termination_notice_days: 30,
  special_provisions: "",
};

const allUtilities = ["Water", "Electricity", "Gas", "Trash", "Internet", "Cable", "Sewer"];

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("auth_token") || localStorage.getItem("token") || ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed`);
  return res.json();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LeaseGeneratorPage() {
  const [step, setStep] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [lease, setLease] = useState<LeaseData>(initialLease);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [propsRes, tenantsRes] = await Promise.all([
          apiGet("/properties"),
          apiGet("/tenants"),
        ]);
        const propsData = Array.isArray(propsRes) ? propsRes : propsRes.data || propsRes.properties || [];
        const tenantsData = Array.isArray(tenantsRes) ? tenantsRes : tenantsRes.data || tenantsRes.tenants || [];
        setProperties(propsData);
        setTenants(tenantsData);
      } catch {
        setError("Failed to load data. Please ensure you're connected.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function updateLease<K extends keyof LeaseData>(key: K, value: LeaseData[K]) {
    setLease((prev) => ({ ...prev, [key]: value }));
  }

  function toggleUtility(util: string) {
    setLease((prev) => ({
      ...prev,
      utilities_included: prev.utilities_included.includes(util)
        ? prev.utilities_included.filter((u) => u !== util)
        : [...prev.utilities_included, util],
    }));
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return !!(lease.property_id && lease.tenant_id);
      case 1: return !!(lease.start_date && lease.end_date && lease.rent_amount > 0);
      case 2: return true;
      case 3: return true;
      case 4: return !!signatureName.trim();
      default: return true;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/leases", lease);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProperty = properties.find((p) => p.id === lease.property_id);
  const selectedTenant = tenants.find((t) => t.id === lease.tenant_id);

  function leasePreviewHTML() {
    return `
      <div style="font-family: 'Georgia', serif; max-width: 700px; margin: 0 auto; padding: 40px; color: #2A2520; line-height: 1.6;">
        <h1 style="text-align: center; font-size: 28px; margin-bottom: 8px; color: #A85A3C;">RESIDENTIAL LEASE AGREEMENT</h1>
        <hr style="border: none; border-top: 2px solid #C97B5A; margin: 20px 0;" />
        <p style="text-align: center; font-size: 14px; color: #6B6357;">Pabandi Property Management</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">1. PARTIES</h2>
        <p>This lease agreement is entered into between <strong>Pabandi Property Management</strong> ("Landlord") and <strong>${selectedTenant?.name || "[Tenant Name]"}</strong> ("Tenant").</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">2. PROPERTY</h2>
        <p>The leased premises is located at:<br />
        <strong>${selectedProperty?.address || "[Property Address]"}</strong><br />
        ${selectedProperty?.unit ? `Unit: ${selectedProperty.unit}<br />` : ""}
        ${selectedProperty?.city || ""}, ${selectedProperty?.state || ""} ${selectedProperty?.zip || ""}</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">3. LEASE TERM</h2>
        <p>This lease shall commence on <strong>${formatDate(lease.start_date)}</strong> and end on <strong>${formatDate(lease.end_date)}</strong>.</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">4. RENT</h2>
        <p>Tenant agrees to pay <strong>${formatCurrency(lease.rent_amount)}</strong> per ${lease.rent_period === "monthly" ? "month" : lease.rent_period === "weekly" ? "week" : "year"}, due on the 1st of each period.</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">5. SECURITY DEPOSIT</h2>
        <p>A security deposit of <strong>${formatCurrency(lease.security_deposit)}</strong> is required prior to move-in.</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">6. PETS</h2>
        <p>Pet fee: <strong>${formatCurrency(lease.pet_fee)}</strong><br />
        Monthly pet rent: <strong>${formatCurrency(lease.pet_monthly_fee)}</strong></p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">7. LATE FEES</h2>
        <p>A late fee of <strong>${formatCurrency(lease.late_fee)}</strong> will be applied after a grace period of <strong>${lease.grace_period_days} days</strong>.</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">8. UTILITIES</h2>
        <p>Included utilities: <strong>${lease.utilities_included.length > 0 ? lease.utilities_included.join(", ") : "None"}</strong></p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">9. RENEWAL</h2>
        <p>${lease.renewal_terms}</p>

        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">10. TERMINATION</h2>
        <p>Either party must provide <strong>${lease.termination_notice_days} days</strong> written notice to terminate this lease.</p>

        ${lease.special_provisions ? `
        <h2 style="font-size: 18px; color: #A85A3C; margin-top: 24px;">11. SPECIAL PROVISIONS</h2>
        <p>${lease.special_provisions}</p>` : ""}

        <hr style="border: none; border-top: 1px solid #BFB3A3; margin: 32px 0;" />
        <p style="font-size: 12px; color: #BFB3A3; text-align: center;">
          Generated by Pabandi • ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    `;
  }

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={{ color: "var(--warm-ink)", marginTop: 16 }}>Loading properties &amp; tenants...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={styles.pageContainer}>
        <div style={{ ...styles.card, textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h2 style={{ color: "var(--sage)", marginBottom: 8 }}>Lease Sent Successfully!</h2>
          <p style={{ color: "var(--soft-stone)", marginBottom: 32 }}>
            The lease agreement has been generated and sent to {selectedTenant?.name || "the tenant"}.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setStep(0);
              setLease(initialLease);
              setSignatureName("");
            }}
            style={styles.primaryBtn}
          >
            Generate Another Lease
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.header}>
        <h1 style={styles.title}>Lease Generator</h1>
        <p style={styles.subtitle}>Create professional lease agreements in minutes</p>
      </div>

      {/* Step Indicator */}
      <div style={styles.stepIndicator}>
        {STEPS.map((label, i) => (
          <div key={i} style={styles.stepItem}>
            <div
              style={{
                ...styles.stepCircle,
                ...(i === step ? styles.stepCircleActive : {}),
                ...(i < step ? styles.stepCircleDone : {}),
              }}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              style={{
                ...styles.stepLabel,
                ...(i === step ? styles.stepLabelActive : {}),
              }}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <div style={styles.stepConnector} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={styles.errorBox}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Step Content */}
      <div style={styles.card}>
        {step === 0 && (
          <div>
            <h2 style={styles.sectionTitle}>Select Property &amp; Tenant</h2>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Property</label>
              <select
                style={styles.select}
                value={lease.property_id}
                onChange={(e) => updateLease("property_id", e.target.value)}
              >
                <option value="">Choose a property...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.address}
                    {p.unit ? ` (Unit ${p.unit})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Tenant</label>
              <select
                style={styles.select}
                value={lease.tenant_id}
                onChange={(e) => updateLease("tenant_id", e.target.value)}
              >
                <option value="">Choose a tenant...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.email}
                  </option>
                ))}
              </select>
            </div>
            {selectedProperty && (
              <div style={styles.infoBox}>
                <strong>{selectedProperty.name}</strong><br />
                {selectedProperty.address}
                {selectedProperty.unit && ` • Unit ${selectedProperty.unit}`}<br />
                {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
              </div>
            )}
            {selectedTenant && (
              <div style={styles.infoBox}>
                <strong>{selectedTenant.name}</strong><br />
                {selectedTenant.email}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={styles.sectionTitle}>Lease Terms</h2>
            <div style={styles.row}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Start Date</label>
                <input type="date" style={styles.input} value={lease.start_date} onChange={(e) => updateLease("start_date", e.target.value)} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>End Date</label>
                <input type="date" style={styles.input} value={lease.end_date} onChange={(e) => updateLease("end_date", e.target.value)} />
              </div>
            </div>
            <div style={styles.row}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Rent Amount ($)</label>
                <input type="number" style={styles.input} value={lease.rent_amount || ""} onChange={(e) => updateLease("rent_amount", parseFloat(e.target.value) || 0)} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Rent Period</label>
                <select style={styles.select} value={lease.rent_period} onChange={(e) => updateLease("rent_period", e.target.value as LeaseData["rent_period"])}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>
            <div style={styles.row}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Security Deposit ($)</label>
                <input type="number" style={styles.input} value={lease.security_deposit || ""} onChange={(e) => updateLease("security_deposit", parseFloat(e.target.value) || 0)} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Late Fee ($)</label>
                <input type="number" style={styles.input} value={lease.late_fee || ""} onChange={(e) => updateLease("late_fee", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div style={styles.row}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Pet Fee ($)</label>
                <input type="number" style={styles.input} value={lease.pet_fee || ""} onChange={(e) => updateLease("pet_fee", parseFloat(e.target.value) || 0)} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Pet Monthly Fee ($)</label>
                <input type="number" style={styles.input} value={lease.pet_monthly_fee || ""} onChange={(e) => updateLease("pet_monthly_fee", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Grace Period (days)</label>
              <input type="number" style={styles.input} value={lease.grace_period_days} onChange={(e) => updateLease("grace_period_days", parseInt(e.target.value) || 0)} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Included Utilities</label>
              <div style={styles.checkboxGroup}>
                {allUtilities.map((util) => (
                  <label key={util} style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={lease.utilities_included.includes(util)}
                      onChange={() => toggleUtility(util)}
                      style={styles.checkbox}
                    />
                    {util}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={styles.sectionTitle}>Additional Clauses</h2>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Renewal Terms</label>
              <textarea
                style={styles.textarea}
                rows={3}
                value={lease.renewal_terms}
                onChange={(e) => updateLease("renewal_terms", e.target.value)}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Termination Notice Period (days)</label>
              <input
                type="number"
                style={styles.input}
                value={lease.termination_notice_days}
                onChange={(e) => updateLease("termination_notice_days", parseInt(e.target.value) || 0)}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Special Provisions</label>
              <textarea
                style={styles.textarea}
                rows={4}
                value={lease.special_provisions}
                onChange={(e) => updateLease("special_provisions", e.target.value)}
                placeholder="Any additional terms or conditions..."
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={styles.sectionTitle}>Review Lease Agreement</h2>
            <div style={styles.previewWrap}>
              <div dangerouslySetInnerHTML={{ __html: leasePreviewHTML() }} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 style={styles.sectionTitle}>Sign &amp; Send</h2>
            <p style={{ color: "var(--soft-stone)", marginBottom: 20 }}>
              By signing below, you confirm all lease details are correct and authorize sending this agreement to the tenant.
            </p>
            <div style={styles.previewWrap}>
              <div dangerouslySetInnerHTML={{ __html: leasePreviewHTML() }} />
            </div>
            <div style={{ ...styles.fieldGroup, marginTop: 24 }}>
              <label style={styles.label}>Landlord Signature (type full name)</label>
              <input
                type="text"
                style={styles.input}
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={styles.navButtons}>
          {step > 0 && (
            <button style={styles.secondaryBtn} onClick={() => setStep((s) => s - 1)} disabled={submitting}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button
              style={{
                ...styles.primaryBtn,
                ...(canProceed() ? {} : styles.primaryBtnDisabled),
              }}
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
            >
              Next →
            </button>
          ) : (
            <button
              style={{
                ...styles.primaryBtn,
                ...(canProceed() && !submitting ? {} : styles.primaryBtnDisabled),
              }}
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
            >
              {submitting ? "Sending..." : "Sign & Send Lease ✍️"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    minHeight: "100vh",
    background: "#FFFFFF",
    padding: "32px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    gap: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid var(--warm-sand, #E8D9C5)",
    borderTop: "4px solid var(--clay, #C97B5A)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  header: {
    marginBottom: 32,
    maxWidth: 800,
    marginLeft: "auto",
    marginRight: "auto",
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: "var(--warm-ink, #2A2520)",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "var(--soft-stone, #BFB3A3)",
    margin: 0,
  },
  stepIndicator: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    maxWidth: 800,
    marginLeft: "auto",
    marginRight: "auto",
    flexWrap: "wrap",
    gap: 8,
  },
  stepItem: {
    display: "flex",
    alignItems: "center",
    position: "relative",
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    background: "var(--warm-sand, #E8D9C5)",
    color: "var(--soft-stone, #BFB3A3)",
    transition: "all 0.3s ease",
  },
  stepCircleActive: {
    background: "var(--clay, #C97B5A)",
    color: "#FFFFFF",
    boxShadow: "0 4px 12px rgba(201, 123, 90, 0.3)",
  },
  stepCircleDone: {
    background: "var(--sage, #8A9A7B)",
    color: "#FFFFFF",
  },
  stepLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: 500,
    color: "var(--soft-stone, #BFB3A3)",
    whiteSpace: "nowrap",
  },
  stepLabelActive: {
    color: "var(--warm-ink, #2A2520)",
    fontWeight: 600,
  },
  stepConnector: {
    width: 24,
    height: 2,
    background: "var(--warm-sand, #E8D9C5)",
    marginLeft: 8,
  },
  card: {
    maxWidth: 800,
    margin: "0 auto",
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 36,
    boxShadow: "0 8px 32px rgba(42, 37, 32, 0.08)",
    border: "1px solid rgba(191, 179, 163, 0.2)",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--warm-ink, #2A2520)",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottom: "2px solid var(--warm-sand, #E8D9C5)",
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--warm-ink, #2A2520)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid var(--warm-sand, #E8D9C5)",
    borderRadius: 12,
    background: "#FAFAFA",
    color: "var(--warm-ink, #2A2520)",
    outline: "none",
    transition: "border-color 0.2s ease",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid var(--warm-sand, #E8D9C5)",
    borderRadius: 12,
    background: "#FAFAFA",
    color: "var(--warm-ink, #2A2520)",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid var(--warm-sand, #E8D9C5)",
    borderRadius: 12,
    background: "#FAFAFA",
    color: "var(--warm-ink, #2A2520)",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  checkboxGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    padding: "12px 16px",
    border: "2px solid var(--warm-sand, #E8D9C5)",
    borderRadius: 12,
    background: "#FAFAFA",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: "var(--warm-ink, #2A2520)",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 8,
    transition: "background 0.15s",
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: "var(--clay, #C97B5A)",
    cursor: "pointer",
  },
  infoBox: {
    marginTop: 8,
    padding: "12px 16px",
    background: "var(--cream, #F5EFE6)",
    borderRadius: 12,
    fontSize: 14,
    color: "var(--warm-ink, #2A2520)",
    lineHeight: 1.5,
  },
  previewWrap: {
    border: "2px solid var(--warm-sand, #E8D9C5)",
    borderRadius: 16,
    overflow: "hidden",
    maxHeight: 600,
    overflowY: "auto",
    background: "#FAFAFA",
  },
  navButtons: {
    display: "flex",
    alignItems: "center",
    marginTop: 32,
    paddingTop: 24,
    borderTop: "1px solid var(--warm-sand, #E8D9C5)",
    gap: 12,
  },
  primaryBtn: {
    padding: "14px 28px",
    fontSize: 15,
    fontWeight: 600,
    color: "#FFFFFF",
    background: "linear-gradient(135deg, var(--clay, #C97B5A), var(--terracotta, #A85A3C))",
    border: "none",
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 12px rgba(201, 123, 90, 0.3)",
  },
  primaryBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  secondaryBtn: {
    padding: "14px 28px",
    fontSize: 15,
    fontWeight: 600,
    color: "var(--warm-ink, #2A2520)",
    background: "var(--warm-sand, #E8D9C5)",
    border: "none",
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  errorBox: {
    maxWidth: 800,
    margin: "0 auto 20px",
    padding: "12px 20px",
    background: "#FFF5F5",
    border: "2px solid var(--dusty-rose, #D4A5A5)",
    borderRadius: 12,
    color: "#C53030",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
};
