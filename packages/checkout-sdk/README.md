# `@pabandi/checkout-sdk`

> Embeddable Drop-In Multi-Rail Escrow Checkout SDK with Built-In BBS+ Zero-Knowledge Trust Verification.

Accept escrow payments across **Solana USDC**, **SBP Raast (Pakistan Instant Bank Transfer)**, and **Credit Cards** with one lightweight script or React component.

---

## ⚡ Quickstart

### 1. Script Tag (Vanilla JS / Webflow / Shopify / WordPress)

Add the script tag to your HTML:

```html
<script src="https://cdn.pabandi.com/v1/checkout.js"></script>

<button id="pay-btn">Deposit Escrow ($150 USDC)</button>

<script>
  document.getElementById('pay-btn').onclick = function () {
    const checkout = Pabandi.initCheckout({
      publishableKey: 'pk_live_your_key',
      amount: 150.00,
      currency: 'USDC',
      referenceId: 'inv_10023',
      title: 'Emergency HVAC Compressor Repair',
      counterparty: {
        id: 'biz_apex_roofing',
        name: 'Apex Commercial HVAC',
        trustScore: 940,
        disputeRate: 0.3,
      },
      verifyCounterpartyZK: true,
      onSuccess: function (event) {
        console.log('Escrow locked:', event.rail, event.txHashOrRef);
      },
      onCancel: function () {
        console.log('Payment dismissed');
      }
    });

    checkout.open();
  };
</script>
```

---

### 2. React / Next.js / Vite (`npm install @pabandi/checkout-sdk`)

```tsx
import React, { useState } from 'react';
import { PabandiCheckoutModal, PabandiCheckoutButton } from '@pabandi/checkout-sdk/react';

export function InvoicePaymentCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      {/* Option A: Drop-in styled button */}
      <PabandiCheckoutButton
        publishableKey="pk_live_your_key"
        amount={250.00}
        currency="USDC"
        referenceId="inv_5541"
        title="Roof Leak Diagnostic & Seal"
        counterparty={{
          id: "tech_01",
          name: "Apex Roofing",
          trustScore: 920,
          disputeRate: 0.2
        }}
        verifyCounterpartyZK={true}
        onSuccess={(event) => alert(`Escrow funded via ${event.rail}!`)}
      />

      {/* Option B: Declarative Controlled Modal */}
      <button onClick={() => setIsOpen(true)}>Custom Pay Button</button>
      <PabandiCheckoutModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        publishableKey="pk_live_your_key"
        amount={250.00}
        currency="USDC"
        referenceId="inv_5541"
        title="Roof Leak Diagnostic & Seal"
        onSuccess={(event) => console.log('Escrow confirmed', event)}
      />
    </div>
  );
}
```

---

## 🛡️ Built-in Zero-Knowledge Reputation Verifier

When `verifyCounterpartyZK: true` is passed, the modal validates that the counterparty meets required reputation predicates:
- **Trust Score $> 800$**
- **Dispute Rate $< 2\%$**

The banner renders a cryptographic badge directly inside the modal header so payers have mathematical proof of counterparty standing before depositing funds into escrow.

---

## 🌐 Supported Rails

| Rail | Settlement Speed | Fees | Assets |
| :--- | :--- | :--- | :--- |
| **Solana USDC** | Instant (400ms) | \$0.001 | USDC (SPL) |
| **SBP Raast** | Real-time | 0 PKR | PKR |
| **Credit Card** | Immediate | Standard | USD / PKR |

---

## 📜 Compliance
- **AAOIFI Sharia Standards Certified**: Riba-free, gharar-mitigated, asset-backed bilateral escrow.

