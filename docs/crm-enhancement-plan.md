# CRM Enhancement Plan — HubSpot/Jobber Parity

## Current State
- **Backend**: `client/src/cleaning/crm/service.ts` — Contacts, Leads, Activities, Notes, pipeline stages, lead sources, CSV import/export
- **Frontend**: CRMPage, SalesCRMPage, TenantDetail, FinancialDashboard, TenantPortal, InspectionReportPage
- **Config**: `crmConfig.ts` — 5 business types with dynamic terminology
- **Routes**: `/property-manager`, `/sales-crm`, `/p/:slug` (tenant portal)

## Target State
Full-featured CRM comparable to HubSpot or Jobber, supporting:
- Visual pipeline/kanban, deal management, forecasting
- Marketing automation, email/SMS sequences, lead scoring
- Advanced reporting, custom dashboards, attribution
- Team collaboration, tasks, calendar, permissions
- Customer portal, knowledge base, ticketing, scheduling
- Integrations (calendar, accounting, Zapier, public API)
- AI-powered recommendations and automation
- PWA with offline support

---

## Phase 1: Core CRM Foundation (Priority: HIGH)
**Goal**: Robust data model and pipeline management

### 1.1 Enhanced Data Model
- [ ] Add `Deal` entity (value, stage, probability, expected close, owner)
- [ ] Add `Task` entity (title, description, due date, priority, status, assignee, related contact/deal)
- [ ] Add `CustomField` definitions (per business type, per entity)
- [ ] Add `Tag` / `List` / `Segment` entities
- [ ] Add `Document` entity (name, type, url, related contact/deal)
- [ ] Add `EmailTemplate` entity (name, subject, body, type)
- [ ] Add `Campaign` entity (name, type, status, audience, send date)
- [ ] Extend `Contact` with: company, title, social profiles, lifecycle stage, score, last contacted, owner
- [ ] Extend `Activity` with: channel, direction, template used, tracking data

### 1.2 Pipeline / Kanban Board
- [ ] Visual Kanban view for deals
- [ ] Drag-and-drop stage transitions
- [ ] Pipeline columns configurable per business type
- [ ] Deal cards showing: title, value, contact, probability, next step
- [ ] Pipeline summary bar (total value, weighted value, count by stage)
- [ ] Inline deal creation and editing
- [ ] Filter/sort pipeline by owner, date range, amount

### 1.3 Advanced Contact Management
- [ ] Contact list with advanced filtering (status, source, tags, owner, date range, custom fields)
- [ ] Bulk actions: tag, assign, change status, delete, export
- [ ] Contact deduplication and merge
- [ ] Contact detail page with timeline (activities, notes, deals, emails)
- [ ] Custom fields per business type
- [ ] Contact import wizard (CSV with field mapping)
- [ ] Contact export (CSV, Excel)
- [ ] Contact lists / saved filters / segments

### 1.4 Deal Management
- [ ] Deal detail page with associated contacts, activities, documents, notes
- [ ] Deal stages with probabilities (configurable)
- [ ] Deal forecasting (commit, best case, worst case)
- [ ] Revenue attribution and source tracking
- [ ] Deal notes and internal comments
- [ ] Deal-related tasks and follow-ups

---

## Phase 2: Marketing & Sales Automation (Priority: HIGH)
**Goal**: Automated outreach and lead nurturing

### 2.1 Email/SMS Integration
- [ ] Email template builder (rich text, merge fields)
- [ ] Email logging (sent, opened, clicked, replied, bounced)
- [ ] One-click email from contact/deal record
- [ ] SMS template library
- [ ] Communication timeline on contact record
- [ ] Email tracking pixel and link tracking
- [ ] Unsubscribe handling

### 2.2 Sequences / Playbooks
- [ ] Sequence builder (steps: email, task, wait, SMS, webhook)
- [ ] Enrollment rules (based on lifecycle stage, source, behavior)
- [ ] Sequence enrollment per contact/deal
- [ ] Sequence performance analytics (sent, opened, replied, converted)
- [ ] Pause/resume/exit sequences
- [ ] A/B testing for sequence steps

### 2.3 Lead Scoring
- [ ] Scoring model configuration (demographic + behavioral)
- [ ] Auto-scoring on contact creation/update
- [ ] Score decay over time
- [ ] Thresholds for lifecycle stage transitions
- [ ] Lead score display on contact record and list
- [ ] Negative scoring (unsubscribes, bounces, inactivity)

### 2.4 Campaigns
- [ ] Campaign creation (email, SMS, mixed)
- [ ] Audience selection (segment, list, filter)
- [ ] Send scheduling (immediate, date-based)
- [ ] Campaign analytics (opens, clicks, replies, conversions)
- [ ] Campaign comparison
- [ ] Template library for campaigns

---

## Phase 3: Reporting & Analytics (Priority: HIGH)
**Goal**: Data-driven insights and custom dashboards

### 3.1 Report Builder
- [ ] Custom report builder with drag-and-drop
- [ ] Report types: contacts, deals, activities, campaigns, revenue
- [ ] Group by, filter, aggregate options
- [ ] Date range picker
- [ ] Scheduled reports (email PDF)
- [ ] Report templates library

### 3.2 Dashboards
- [ ] Dashboard editor (drag-and-drop widgets)
- [ ] Widget types: metric, chart (bar, line, pie, funnel), table, leaderboard
- [ ] Dashboard sharing (public link, password, email)
- [ ] Dashboard refresh intervals
- [ ] Default dashboards per business type
- [ ] Real-time data updates

### 3.3 Analytics
- [ ] Sales funnel analysis
- [ ] Win/loss analysis (reasons, trends)
- [ ] Attribution reporting (first touch, last touch, multi-touch)
- [ ] Cohort analysis (by month, source, campaign)
- [ ] Activity analytics (calls, emails, meetings per rep)
- [ ] Revenue forecasting (pipeline + closed)
- [ ] Email performance (by template, sequence, campaign)
- [ ] Custom date comparisons (period over period)

---

## Phase 4: Team Collaboration (Priority: MEDIUM)
**Goal**: Internal coordination and accountability

### 4.1 Tasks
- [ ] Task creation with title, description, due date, priority, status
- [ ] Task assignment (single or multiple)
- [ ] Task-related entity linking (contact, deal, company)
- [ ] Task comments and activity
- [ ] Task templates
- [ ] Recurring tasks
- [ ] Task views (my tasks, team tasks, all tasks)
- [ ] Task notifications (email, in-app)

### 4.2 Calendar
- [ ] Shared team calendar
- [ ] Appointment/event creation linked to contacts/deals
- [ ] Calendar view (day, week, month)
- [ ] Availability settings
- [ ] Meeting scheduling (buffer times, time zones)
- [ ] Calendar sync (Google Calendar, Outlook via CalDAV/iCal)
- [ ] Reminders and notifications

### 4.3 Team & Permissions
- [ ] Role-based access control (RBAC)
- [ ] Roles: Super Admin, Admin, Manager, Agent, Member, Viewer
- [ ] Permission granularity per entity (view, create, edit, delete, admin)
- [ ] Territory/region assignment for agents
- [ ] Round-robin assignment for leads/deals
- [ ] Team performance reports
- [ ] Activity attribution by team member

### 4.4 Notifications & Mentions
- [ ] In-app notification center
- [ ] Email notifications for mentions, assignments, due dates
- [ ] @mentions in notes, comments, tasks
- [ ] Notification preferences per user
- [ ] Digest emails (daily/weekly)

---

## Phase 5: Customer Portal & Self-Service (Priority: MEDIUM)
**Goal**: Customer-facing tools and automation

### 5.1 Customer Portal
- [ ] White-label customer portal (extend existing TenantPortal)
- [ ] Profile management (contact info, preferences)
- [ ] Service history and documents
- [ ] Communication center (send messages, view thread)
- [ ] Self-service booking/scheduling
- [ ] Payment center (invoices, receipts, payment methods)
- [ ] Knowledge base / FAQ

### 5.2 Ticketing System
- [ ] Ticket creation (email, form, portal, phone)
- [ ] Ticket routing (round-robin, skill-based, escalation)
- [ ] Ticket statuses (open, in progress, waiting, resolved, closed)
- [ ] Ticket priority and SLA tracking
- [ ] Ticket notes and internal comments
- [ ] Customer notifications on status changes
- [ ] Ticket reporting (volume, resolution time, satisfaction)

### 5.3 Scheduling
- [ ] Service types / appointment types
- [ ] Availability calendars per resource/employee
- [ ] Booking engine with time slot selection
- [ ] Confirmation and reminder automation
- [ ] Buffer times and travel time
- [ ] Resource conflict detection
- [ ] Integration with external calendars

### 5.4 Quotes & Invoices
- [ ] Quote builder with line items, taxes, discounts
- [ ] Quote templates per business type
- [ ] Quote-to-deal conversion
- [ ] Invoice generation from quotes or deals
- [ ] Recurring invoice schedules
- [ ] Payment reminders and late notices
- [ ] E-signature integration (DocuSign, PandaDoc, or simple canvas)
- [ ] Payment processing links

---

## Phase 6: Integrations & API (Priority: MEDIUM)
**Goal**: Connect with the tools businesses already use

### 6.1 Calendar Sync
- [ ] Google Calendar two-way sync
- [ ] Outlook/Office 365 calendar sync
- [ ] iCal feed generation
- [ ] Meeting link generation (Zoom, Teams, Google Meet)
- [ ] Calendar event creation from appointments/tasks

### 6.2 Accounting Integration
- [ ] QuickBooks Online sync (customers, invoices, payments)
- [ ] Xero sync
- [ ] Chart of accounts mapping
- [ ] Sync logs and error handling

### 6.3 Zapier / Make.com
- [ ] Zapier app publish (triggers: contact created, deal stage changed, form submitted; actions: create contact, send email, etc.)
- [ ] Make.com (formerly Integromat) scenario templates
- [ ] Webhook triggers for external systems

### 6.4 Public API
- [ ] REST API v1 with authentication (API keys, OAuth)
- [ ] CRUD endpoints for all entities
- [ ] Webhook delivery for events
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Rate limiting and usage tracking

### 6.5 Other Integrations
- [ ] Slack notifications
- [ ] Microsoft Teams notifications
- [ ] Google Workspace (Gmail, Drive)
- [ ] Zapier-style internal webhooks (already partially exists)

---

## Phase 7: AI & Intelligence (Priority: MEDIUM)
**Goal**: Smart automation and predictive insights

### 7.1 Predictive Lead Scoring
- [ ] ML model for lead scoring (features: source, engagement, demographics)
- [ ] Auto-scoring on new leads
- [ ] Score explanation (why this score)
- [ ] Model retraining on conversion data

### 7.2 Next Best Action
- [ ] Recommendation engine for next action per contact
- [ ] Sequence suggestions based on similar leads
- [ ] Optimal send time prediction
- [ ] Contact engagement predictions

### 7.3 Content Generation
- [ ] AI email draft generation
- [ ] AI follow-up message suggestions
- [ ] AI subject line optimization
- [ ] AI meeting summary from notes
- [ ] AI-powered search and insights

### 7.4 Anomaly Detection
- [ ] Unusual activity alerts
- [ ] Churn risk indicators
- [ ] Revenue anomalies
- [ ] Pipeline health warnings

---

## Phase 8: Mobile & Offline (Priority: LOW)
**Goal**: Access CRM anywhere, anytime

### 8.1 PWA Features
- [ ] Service worker for offline caching
- [ ] Install prompt
- [ ] Push notifications
- [ ] Background sync

### 8.2 Mobile UI
- [ ] Mobile-first navigation (bottom tabs)
- [ ] Touch-optimized forms
- [ ] Swipe actions (call, email, delete)
- [ ] Mobile dashboard widgets
- [ ] Offline mode with local storage

---

## Implementation Order
1. **Phase 1** — Core foundation (pipeline, deals, contacts) — enables everything else
2. **Phase 2** — Marketing automation (emails, sequences, scoring) — drives growth
3. **Phase 3** — Reporting (dashboards, custom reports) — visibility
4. **Phase 4** — Collaboration (tasks, calendar, permissions) — team scale
5. **Phase 5** — Customer portal & scheduling — customer experience
6. **Phase 6** — Integrations — ecosystem connectivity
7. **Phase 7** — AI — competitive advantage
8. **Phase 8** — Mobile — accessibility

## Success Metrics
- Time to close deals reduced by 20%
- Lead response time < 5 minutes
- Email open rate > 40%
- Pipeline coverage ratio > 3x
- User adoption > 80% of team active weekly
