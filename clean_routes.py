import re
import sys

def main():
    file_path = 'client/src/App.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    paths_to_hide = [
        "home-old",
        "sharia-transparency", "mudarabah", "profit",
        "property-manager", "sales-crm", "properties", "tenant-workflow", "ai/assistant",
        "property/:id", "p/:slug", "tenant", "tenant-portal",
        "documents", "escrow", "escrow/:id", "tokenomics", "my-wallet", "onramp", "offramp",
        "token", "dashboard", "profile", "calculator", "smart-search", "ai/chat", "ai/analyze",
        "ai/intelligence", "ai/market", "ai/portfolio", "ai/tenant-risk", "ai/lease-anomaly",
        "ai/rent-optimizer", "passport", "passport/dashboard", "passport/:sellerId",
        "trust/:passportId", "trust/:handle", "trust", "trust/pulse", "trust/jury",
        "agent-passport", "background-check", "background-check/:id", "protected-deposit",
        "arbitration", "safemeet", "disputes", "cashout", "payroll", "support",
        "support/tickets", "support/tickets/:id", "support/kb", "support/kb/:slug", "support/admin",
        "economy", "revenue", "rewards", "refer", "verifier", "book", "book/:id",
        "reservations", "reservations/new", "nightlife", "promoter", "agent-dashboard",
        "agent-marketplace", "agent-marketplace/agents/:slug", "agent-marketplace/projects/:projectId",
        "live-sell", "live-selling", "freelance", "storefront", "gigs", "gigs/:id", "jobs/:id", "jobs",
        "workspace/:id", "hotels", "hospitality", "real-estate/screening/:reservationId",
        "business/join", "business/join-claim", "business/register", "business/:id",
        "business/:id/book", "business/activate/:id", "business/crm", "crm", "post-business",
        "business/settings", "business/analytics", "business/plugins", "business-model",
        "join", "pricing", "checkout/:sessionId", "checkout-success", "checkout-cancel",
        "demo-checkout", "s/:sellerId", "t/pay/:sellerId", "b/:slug", "onboarding", "dashboard",
        "web3", "lp-terminal", "usdy", "solana-escrow", "solana-escrow/:id", "airdrop",
        "payment-test", "fiat/:reference", "fiat", "rent-roll", "leases", "maintenance",
        "applications", "profiles", "profiles/category/:category", "profiles/:id", "technology",
        "forgot-password", "reset-password/:token", "partners", "grants", "promo", "promotions",
        "daraz-scanner", "notifications", "outreach", "partners/dashboard", "partners/marketplace",
        "sale/:id", "waitlist", "r/:code", "city/:slug", "admin", "admin/setup"
    ]

    new_content = content
    for p in paths_to_hide:
        # Match <Route path="<path>" ... to the end of the line
        pattern = r'(^[ \t]*<Route\s+path="' + re.escape(p) + r'".*?\n)'
        # Replace the entire line with the new route definition
        replacement = r'            <Route path="' + p + r'" element={<PlaceholderPage />} />\n'
        new_content = re.sub(pattern, replacement, new_content, flags=re.MULTILINE)

    with open(file_path, 'w') as f:
        f.write(new_content)
        
    print("Routes replaced successfully.")

if __name__ == "__main__":
    main()
