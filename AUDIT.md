# AUDIT.md — PabandiOS ContactOS: 17-Phase Roadmap Status

**Date**: 2026-09-27  
**Scope**: ContactOS CRM only (per rule: do not touch BookingOS, FreightOS, PropertyOS, LedgerOS)  
**Baseline**: Visual polish pass just pushed (commit 5f3f64d0) — primitives, CSS motion system, 7 CRM pages clay-patched, PipelineOSDashboard rewritten.

---

## Phase 0: Audit (this document)

### What exists and is solid

**Design tokens** (`client/src/styles/warm-clay.css`): Full palette, shadows, radii, easing, typography, atmosphere gradient — all defined and referenced.

**CSS motion system** (`client/src/index.css`): `clay-rise`, `clay-fade`, `clay-scale-in`, `clay-delay-1..6`, `clay-heading`, `clay-card--interactive`, `clay-stat-icon`, `clay-filter-chip`, `clay-kanban-column`, `clay-toggle-*`, `clay-field-*`, `clay-alert-*`, `clay-empty-icon`, `clay-tab-*`, `clay-table-row`. `prefers-reduced-motion` respected.

**Primitives (built + clay-treated)**:
| Primitive | File | Status |
|---|---|---|
| `Button` | `primitives/Button.tsx` | ✅ variants (primary/secondary/ghost/danger), press states, tactile shadows |
| `Card` | `primitives/Card.tsx` | ✅ variants (default/flat/pressed), hover, interior lighting `::before` |
| `Chip` | `primitives/Chip.tsx` | ✅ 5 variants, 2 sizes, removable not yet built |
| `Input` | `primitives/Input.tsx` | ✅ text + textarea, focus states, label styling |
| `Modal` | `primitives/Modal.tsx` | ✅ Framer Motion enter/exit, backdrop, Esc close, clay-heading, clay-card |
| `EmptyState` | `primitives/EmptyState.tsx` | ✅ Card-wrapped, clay-scale-in, icon/title/description/CTA |

**CRM pages (clay-patched, functional)**:
| Page | Route | Status |
|---|---|---|
| Dashboard | `/contact` | ✅ PipelineOSDashboard — greeting, stats, alerts feed, client directory, kanban snapshot |
| Clients list | `/contact/clients` | ✅ table, search, filters, add modal |
| Client detail | `/contact/clients/:id` | ✅ command center, timeline, financials, reliability, quick actions |
| Deals kanban | `/contact/deals` | ✅ columns, deal cards, filter/search, create modal |
| Activities | `/contact/activities` | ✅ timeline, type filters, quick-add modal |
| Jobs | `/contact/jobs` | ✅ list/calendar toggle, filters, create modal |
| Invoices | `/contact/invoices` | ✅ list, filters, create modal, detail page |
| Invoice detail | `/contact/invoices/:id` | ✅ exists (`InvoiceDetailPage`) |
| Settings/modules | `/contact/settings/modules` | ✅ module + feature toggles with clay toggles |
| Setup wizard | `/contact/setup` | ✅ exists (`SetupWizardPage`) |

**Infrastructure**:
- `DashboardLayout` — sidebar with Framer Motion `layoutId` indicator, mobile drawer, mobile bottom tab bar, breadcrumb header, motion.page entrance (opacity + y). ✅
- `useBusinessSettings` + `useFeatureGate` hooks — exist. ✅
- Prisma schema: `CrmBusiness`, `CrmClient`, `CrmDeal`, `CrmActivity`, `CrmJob`, `CrmEmployee`, `CrmPayroll`, `CrmExpense`, `CrmFile`, `Invoice` — all present. ✅
- Routes registered in `App.tsx` for all 7 ContactOS pages + setup. ✅

---

### Phase 1: Shared Design System — gap analysis

| Primitive | Required | Status | Notes |
|---|---|---|---|
| `ClayButton` | 4 variants, 5 states | ✅ Done | Already built as `Button`. Loading state not yet built. |
| `ClayCard` | Rest / hover | ✅ Done | Already built as `Card`. |
| `ClayStat` | Number + label + trend | ❌ Not built | Inline `StatCard` in ContactOSPage + ContactClientDetailPage. Needs extraction to primitive with trend direction (up/down/neutral). |
| `ClayTable` | Sortable / row hover / select | ❌ Not built | Client list uses hand-rolled table. Needs proper primitive. |
| `ClayChip` | Default / removable | ⚠️ Partial | `Chip` exists, 5 variants. Removable (onClick ×) not built. |
| `ClayBadge` | 5 variants | ⚠️ Partial | Inline `ClayBadge` in PipelineOSDashboard. Needs extraction to primitive. |
| `ReliabilityChip` | 4 tiers | ✅ Done | Exists as separate component `components/reliability/ReliabilityChip`. |
| `StatusChip` | Context-specific | ⚠️ Partial | Inline `StatusChip` in ContactJobsPage. Needs extraction. |
| `ClayModal` | Enter/exit | ✅ Done | Already built as `Modal`. |
| `ClayDrawer` | Enter/exit | ❌ Not built | Mobile sidebar uses raw Framer Motion in DashboardLayout. Needs dedicated primitive. |
| `ClayToast` | Auto-dismiss | ❌ Not built | No toast system exists. Need context + provider. |
| `ClayInput` | 4 states | ✅ Done | Already built as `Input`. Error state styling not yet built. |
| `ClaySelect` | 3 states | ❌ Not built | Pages use raw `<select>` with `clay-field-input` class. Needs primitive. |
| `ClayTextarea` | 3 states | ❌ Not built | `Input` has `textarea` prop. Could be promoted or separate. |
| `ClayTabs` | Sliding indicator | ❌ Not built | Client detail uses hand-rolled tabs. Needs primitive with Framer Motion indicator. |
| `ClayDropdown` | Open/close | ❌ Not built | No dropdown primitive. Client search uses inline dropdown. |
| `ClayEmptyState` | Icon + title + desc + CTA | ✅ Done | Already built. |
| `ClaySkeleton` | Pulse | ❌ Not built | No skeleton primitive. Loading uses raw "Loading..." text or spinners in places. |

**Phase 1 verdict**: 6 of 17 primitives exist. 11 need building or extraction. The 6 that exist are already used across CRM pages. Do not add new primitives until the missing ones are built — the brief says "Do not build pages until all primitives exist and are tested in isolation."

---

### Phase 2: Motion & Depth — gap analysis

| Item | Status | Notes |
|---|---|---|
| Atmosphere gradient | ✅ | `DashboardLayout` applies `var(--atmosphere)` to root. |
| Page entrance (fade from 4px below, 400ms) | ✅ | `DashboardLayout` motion.div: `initial={{ opacity: 0, y: 4 }}`, 300ms. Close enough — could tune to 400ms. |
| Primary action card delayed 100ms | ❌ | Not implemented. Dashboard greeting is immediate. |
| Stat cards stagger (80ms) | ⚠️ | `StatCard` accepts `delay` prop and applies `animationDelay`. Used in ContactOSPage. Not consistently applied across all pages. |
| Feed items slide from left (60ms) | ❌ | Alerts feed in PipelineOSDashboard renders cards without staggered entrance. |
| Sidebar shadow lift | ✅ | `var(--shadow-sidebar)` applied. |
| Active indicator slides (layoutId) | ✅ | `layoutId="nav-indicator"` on sidebar, `layoutId="mobile-tab-indicator"` on mobile tabs. |
| Collapsible groups (chevron rotate 250ms) | ❌ | Sidebar is flat nav — no collapsible groups exist. Not yet needed. |
| Modal backdrop fade 200ms | ✅ | `Modal` backdrop: 200ms fade. |
| Modal content scale 0.96→1.0 bounce 300ms | ⚠️ | `Modal` uses `scale: 0.92`, 300ms with spring easing. Close to spec (0.96 vs 0.92). |
| Esc closes with reverse | ✅ | `Modal` handles Esc, AnimatePresence handles exit reverse. |
| Tabs sliding indicator (layoutId) | ❌ | Not built. Client detail tabs are hand-rolled. |
| Tab content crossfade 200ms | ❌ | Not built. |
| `MOTION.md` | ❌ | Does not exist. Needs to be written after primitives are complete. |

**Phase 2 verdict**: Core motion infrastructure is in place (atmosphere, page entrance, sidebar indicator, modal animations). Missing: stagger consistency, feed slide-in, tab system, `MOTION.md`.

---

### Phase 3: Dashboard — gap analysis

The existing `PipelineOSDashboard` is a kanban-centric dashboard. The brief wants a "Good afternoon, [Name]" command-center layout with left main + right panel.

| Element | Status | Notes |
|---|---|---|
| Time-of-day greeting | ⚠️ | Greeting exists but is static ("Good morning" hardcoded or absent). Need `new Date().getHours()` logic. |
| Contextual primary action card | ❌ | Dashboard has primary action area but it's not state-aware (0 clients → "Add first client", etc.). |
| 3 stat cards (Clients / Pipeline / Invoices) | ⚠️ | Stats exist but not exactly these 3, and not consistently clickable → filtered list. |
| Right panel: day-at-a-glance | ✅ | Alerts feed + client directory exist. Items clickable. |
| Numbers count up on load (800ms) | ❌ | Stats render static values. No count-up animation. |
| Empty state: 3-step onboarding checklist | ❌ | Setup wizard exists at `/contact/setup` but dashboard doesn't conditionally show checklist. |

**Phase 3 verdict**: Dashboard exists and is functional. Needs: time-aware greeting, contextual primary action, count-up animation, onboarding checklist integration.

---

### Phase 4: Clients Module — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 4.1 Client list — table | ✅ | Name, email, phone, company, reliability, last contact, LTV, actions. Search + filters + sort + bulk select + pagination + column picker all implemented. |
| 4.1 "+ Add Client" + empty state | ✅ | Primary button + EmptyState with CTA. |
| 4.2 Client detail — two-column command center | ⚠️ | Exists but uses 7 tabs (not the two-column layout in the brief). Timeline, financials, reliability, quick actions all present. The brief explicitly says "no 7 tabs" — current implementation uses tabs. |
| 4.2 Custom fields section | ❌ | `customData` Json field exists on `CrmClient`. UI not built. |
| 4.3 Client create/edit — full-page form | ❌ | Create uses modal, not full-page form. Autosave not built. |
| 4.4 Soft delete + restore | ❌ | Delete exists (hard delete?). Soft delete + 30-day restore not built. |

**Phase 4 verdict**: Client list is the strongest page. Client detail needs layout change (tabs → two-column). Create/edit needs full-page form + autosave. Soft delete not built.

---

### Phase 5: Deals Module — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 5.1 Deals kanban | ✅ | Columns from `STAGES` constant. Drag-and-drop? Not verified — needs check. Column headers show count. Deal cards have client, value, date, reliability, age. "+ New Deal" button. Table view toggle not built. |
| 5.2 Deal detail | ❌ | Route does not exist. No `/contact/deals/:id` page. |
| 5.3 Create deal | ⚠️ | Create modal exists on deals page. Client picker, title, value, close date, stage — verify all present. |
| 5.4 Pipeline forecast widget | ❌ | Not built. No forecast on dashboard or deals page. |

**Phase 5 verdict**: Kanban list is strong. Deal detail page missing. Forecast widget missing.

---

### Phase 6: Activities Module — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 6.1 Unified inbox | ✅ | Timeline of all activities. Filter chips (All/Calls/Emails/Meetings/Notes/Tasks). Search by content. |
| 6.2 Quick add floating button | ❌ | No floating button. Quick add is in modals triggered by page buttons. |
| 6.3 Activity detail | ❌ | No dedicated activity detail page. Activities are shown in timeline cards. |

**Phase 6 verdict**: Unified inbox is solid. Quick-add floating button missing. Activity detail not a separate page (may be acceptable as inline expansion).

---

### Phase 7: Tasks Module — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 7.1 Task list (table) | ❌ | Not built. `CrmActivity` has `type: TASK` but no dedicated task UI. |
| 7.2 Board view | ❌ | Not built. |
| 7.3 Calendar view | ❌ | Not built. |
| 7.4 Task detail | ❌ | Not built. |
| 7.5 Quick add | ❌ | Not built. |

**Phase 7 verdict**: Entirely not built. Tasks exist as activity type in the data model but have no UI.

---

### Phase 8: Companies Module — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 8.1 Schema | ❌ | `CrmCompany` model not in Prisma schema. `CrmClient` has no `companyId`/`company` relation. |
| 8.2 List/detail/create pages | ❌ | Not built. No `/contact/companies` route. |
| 8.3 Client detail integration | ❌ | Not built. |

**Phase 8 verdict**: Not started. Schema change required first.

---

### Phase 9: Invoices Module — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 9.1 List with filters | ✅ | All/Draft/Sent/Paid/Overdue filters exist. |
| 9.2 Detail view | ✅ | `InvoiceDetailPage` exists at `/contact/invoices/:id`. |
| 9.3 Create invoice | ✅ | Create modal on invoices page. |
| 9.4 Edit draft | ⚠️ | Verify edit capability exists in detail page. |
| 9.5 Send → payment link | ⚠️ | `PayInvoicePage` exists at `/pay/:invoiceId`. Verify integration from invoice detail. |
| 9.6 Mark paid → trust event | ❌ | Verify that marking paid fires trust event and updates `paymentScore`. |
| 9.7 Tx hash + Solscan link | ⚠️ | Present in invoice detail? Verify. |

**Phase 9 verdict**: Core invoice flow exists. Need to verify: edit, send→payment link integration, mark-paid trust event, tx hash display.

---

### Phase 10: Team Module — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 10.1 Member list | ❌ | `CrmEmployee` exists in schema. No `/contact/team` route or page. |
| 10.2 Member detail | ❌ | Not built. |
| 10.3 Invite flow | ❌ | Not built. |
| 10.4 Permissions | ❌ | Not built. |
| 10.5 Remove member | ❌ | Not built. |

**Phase 10 verdict**: Not started. Schema exists (`CrmEmployee`). No routes or pages.

---

### Phase 11: Reports — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| Pipeline funnel | ❌ | Not built. |
| Win rate / avg deal size / sales cycle | ❌ | Not built. |
| Activities per week | ❌ | Not built. |
| At-risk clients | ❌ | Not built. |
| Top clients | ❌ | Not built. |
| Trust score distribution | ❌ | Not built. |
| Charts in clay palette | ❌ | No chart library integrated. |

**Phase 11 verdict**: Not started.

---

### Phase 12: Custom Fields — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| 12.1 UI: `/contact/settings/custom-fields` | ❌ | No route. No page. |
| 12.2 Rendering on forms/detail/list | ❌ | `customData` Json exists on `CrmClient`. Not rendered anywhere. |
| 12.3 Storage | ✅ | `customData` Json @default("{}") on `CrmClient`. `BusinessSettings` model exists for field definitions. |

**Phase 12 verdict**: Storage foundation exists. UI entirely not built.

---

### Phase 13: Custom Pipelines — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| `/contact/settings/pipeline` | ❌ | No route. No page. |
| Drag-to-reorder stages | ❌ | Not built. |
| Edit name/probability/color | ❌ | Not built. |
| Add/remove stages | ❌ | Not built. |
| Reset to default for vertical | ❌ | Not built. |

**Phase 13 verdict**: Not started. Deals kanban uses hardcoded `STAGES` constant.

---

### Phase 14: Settings Hub — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| Settings index page | ❌ | No `/contact/settings` index. Navigating to settings goes directly to `/contact/settings/modules`. |
| Business Profile | ❌ | Not built as settings page. |
| Modules | ✅ | `/contact/settings/modules` exists. |
| Custom Fields | ❌ | See Phase 12. |
| Pipeline | ❌ | See Phase 13. |
| Navigation (reorder/hide) | ❌ | Not built. |
| Team | ❌ | See Phase 10. |
| Integrations | ❌ | Placeholder not built. |
| API Keys | ❌ | Placeholder not built. |
| Webhooks | ❌ | Placeholder not built. |
| Billing | ❌ | Placeholder not built. |

**Phase 14 verdict**: Only modules settings exists. Need settings hub index + all sub-pages.

---

### Phase 15: Data Connectors — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| Connector framework | ❌ | Not built. |
| Google Calendar 2-way sync | ❌ | Not built. |
| Slack notifications | ❌ | Not built. |
| Zapier webhook outbound | ❌ | Not built. |
| Integrations UI grid | ❌ | Not built. |

**Phase 15 verdict**: Not started.

---

### Phase 16: Webhooks & Public API — gap analysis

| Sub-feature | Status | Notes |
|---|---|---|
| Webhooks UI: add URL, events, HMAC | ❌ | Not built. |
| Delivery log with retry | ❌ | Not built. |
| API keys: generate/revoke, usage stats | ❌ | Not built. |
| OpenAPI docs link | ❌ | Not built. |
| Rate limit 1000 req/hr | ❌ | Not built. |

**Phase 16 verdict**: Not started.

---

### Phase 17: Global Polish — gap analysis

| Item | Status | Notes |
|---|---|---|
| Empty states — one CTA each | ⚠️ | EmptyState primitive exists. Not consistently used across all pages. |
| Loading skeletons — clay pulse | ❌ | No `ClaySkeleton` primitive. Loading uses raw text or spinners. |
| Error states — friendly copy + retry | ❌ | API errors shown as raw console.error. No user-facing error UI. |
| Toasts — success/failure | ❌ | No toast system. |
| Modals — keyboard accessible | ✅ | Modal handles Esc. Tab/Enter not explicitly handled. |
| Tables — sticky headers, column picker | ⚠️ | Client table has column picker. Sticky headers not verified. |
| Forms — inline validation, autosave | ❌ | Validation exists on some forms. Autosave not built. |
| Keyboard shortcuts (Cmd+K, C, G C) | ❌ | Not built. |
| Mobile 375px — no horizontal scroll | ⚠️ | DashboardLayout has mobile drawer + bottom tabs. Need manual verification. |
| Performance — <1.5s desktop / <3s mobile | ⚠️ | Not measured. Build is 3.8MB JS bundle (large). |

**Phase 17 verdict**: Foundations exist (EmptyState, Modal, mobile layout). Missing: skeletons, error UI, toasts, keyboard shortcuts, validation/autosave, performance measurement.

---

## Summary: What's done vs ahead

### Done (visual foundation + core CRM)
- Design tokens, CSS motion system, 6 primitives, DashboardLayout with Framer Motion
- 7 CRM pages clay-patched and functional (dashboard, clients, client detail, deals, activities, jobs, invoices)
- Settings/modules page with feature toggles
- Setup wizard
- Prisma schema for core CRM entities

### Not started (feature phases)
- Phase 1 remaining: 11 primitives (ClayStat, ClayTable, ClayBadge extraction, ClayDrawer, ClayToast, ClaySelect, ClayTabs, ClayDropdown, ClaySkeleton, removable Chip, loading Button)
- Phase 2 remaining: MOTION.md, stagger consistency, feed slide-in, tab system
- Phase 3 remaining: time-aware greeting, contextual primary action, count-up, onboarding checklist
- Phase 4 remaining: client detail layout (tabs → two-column), full-page create/edit, autosave, soft delete
- Phase 5 remaining: deal detail page, forecast widget, table view toggle, drag-and-drop verification
- Phase 6 remaining: floating quick-add button
- Phase 7: entirely not built (Tasks)
- Phase 8: entirely not built (Companies — schema change needed)
- Phase 9: verify edit/send/trust-event/tx-hash
- Phase 10: entirely not built (Team)
- Phase 11: entirely not built (Reports)
- Phase 12: entirely not built (Custom Fields UI)
- Phase 13: entirely not built (Custom Pipelines)
- Phase 14: settings hub index + all sub-pages
- Phase 15: entirely not built (Connectors)
- Phase 16: entirely not built (Webhooks + API)
- Phase 17: skeletons, error UI, toasts, keyboard shortcuts, validation/autosave, mobile verification, performance

### Rules check
- ✅ ContactOS only — no BookingOS/FreightOS/PropertyOS/LedgerOS touched
- ✅ No new features added in this pass — visual + motion only
- ✅ Primitives audited before changes
- ⚠️ No browser verification with screenshots done yet (deploy is fresh)
- ⚠️ No `MOTION.md` written yet

---

## Recommendation

The visual foundation (Phases 1-2) is ~60% complete. Before building feature phases, finish the primitive set — specifically the 11 missing primitives — so every subsequent page inherits a complete system. Then write `MOTION.md`. Then proceed phase by phase.

**Suggested next step**: Greenlight Phase 1 completion (build the 11 missing primitives in isolation, no pages yet). 

**Alternative**: Greenlight Phase 0 complete — proceed to Phase 1.
