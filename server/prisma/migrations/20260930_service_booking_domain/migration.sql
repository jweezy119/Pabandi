-- ══════════════════════════════════════════════════════════════════════════════
-- Service booking domain: providers, resources, appointments, escrow
--
-- Why this exists
--   The salon / service-owner vertical is the beachhead, and it had no domain
--   to live in. Specifically:
--
--     • `Escrow` is User → User. A salon is a `Business`. So the primitive the
--       product is built around — money held against a booked service — could
--       not be expressed at all. `ServiceEscrow` is purpose-built for a
--       business party and keeps the settlement terms denormalised.
--
--     • There were no appointment, provider or resource models. `Reservation` is
--       restaurant-table booking; `PropertyAppointment` is a viewing. Neither
--       can detect that two clients have been sold the same chair.
--
--     • `BusinessService` carried a price and a duration but nothing about how a
--       booking is secured or cancelled. The terms a customer accepts now live
--     on the service, so a later price edit cannot retroactively change what an
--     existing booking was agreed under.
--
-- Shariah constraints are enforced in src/config/sharia.ts, not here. The
-- database's job is to make the prohibited states unrepresentable where it can
-- (a retainer is stored with the basis points actually agreed, the
-- documentation of actual cancellation cost is stored next to it) and to leave
-- the judgement to the service layer where the business rules live.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Bookable-service terms ────────────────────────────────────────────────────
-- Appended to the existing catalogue rather than replacing it: restaurants and
-- hotels use BusinessService too, and null/zero defaults mean they are unaffected.

ALTER TABLE "BusinessService"
  ADD COLUMN "requiredResourceKind"  TEXT,
  ADD COLUMN "requiresProvider"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "genderPolicy"         TEXT    NOT NULL DEFAULT 'UNSPECIFIED',
  ADD COLUMN "retainerBps"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cancellationNoticeHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "cancellationCostAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "noShowForfeitsRetainer"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "minNoticeHours"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "turnaroundMinutes"     INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "BusinessService_businessId_requiredResourceKind_idx"
  ON "BusinessService"("businessId", "requiredResourceKind");

-- ── Providers (staff who perform services) ───────────────────────────────────

CREATE TABLE "BusinessProvider" (
    "id"                  TEXT NOT NULL,
    "businessId"          TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "phone"               TEXT,
    "role"                TEXT NOT NULL DEFAULT 'PROVIDER',
    "gender"              TEXT NOT NULL DEFAULT 'UNSPECIFIED',
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 0,
    "bio"                 TEXT,
    "photoUrl"            TEXT,
    "isActive"            BOOLEAN NOT NULL DEFAULT true,
    "noticeMinutes"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProvider_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessProvider_businessId_isActive_idx" ON "BusinessProvider"("businessId", "isActive");
CREATE INDEX "BusinessProvider_businessId_gender_idx"    ON "BusinessProvider"("businessId", "gender");

ALTER TABLE "BusinessProvider"
  ADD CONSTRAINT "BusinessProvider_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Resources (the exclusive thing a service occupies) ───────────────────────

CREATE TABLE "BusinessResource" (
    "id"         TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind"       TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "isPrivate"  BOOLEAN NOT NULL DEFAULT false,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessResource_businessId_kind_isActive_idx" ON "BusinessResource"("businessId", "kind", "isActive");

ALTER TABLE "BusinessResource"
  ADD CONSTRAINT "BusinessResource_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Provider working hours ───────────────────────────────────────────────────

CREATE TABLE "ProviderAvailability" (
    "id"          TEXT NOT NULL,
    "providerId"  TEXT NOT NULL,
    "dayOfWeek"   INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute"   INTEGER NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderAvailability_pkey" PRIMARY KEY ("id"),
    -- A provider cannot be on shift twice for the same day.
    CONSTRAINT "ProviderAvailability_provider_day_key" UNIQUE ("providerId", "dayOfWeek", "startMinute")
);

CREATE INDEX "ProviderAvailability_providerId_dayOfWeek_idx" ON "ProviderAvailability"("providerId", "dayOfWeek");

ALTER TABLE "ProviderAvailability"
  ADD CONSTRAINT "ProviderAvailability_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "BusinessProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Appointments ─────────────────────────────────────────────────────────────

CREATE TABLE "Appointment" (
    "id"                 TEXT NOT NULL,
    "businessId"         TEXT NOT NULL,
    "customerId"         TEXT NOT NULL,
    "providerId"         TEXT,
    "resourceId"         TEXT,
    "startsAt"           TIMESTAMP(3) NOT NULL,
    "endsAt"             TIMESTAMP(3) NOT NULL,
    "blockMinutes"       INTEGER NOT NULL DEFAULT 0,
    "status"             TEXT NOT NULL DEFAULT 'REQUESTED',
    "quotedPrice"        DOUBLE PRECISION NOT NULL,
    "retainerAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retainerBps"        INTEGER NOT NULL DEFAULT 0,
    "cancellationCost"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerTrustSnapshot" JSONB,
    "providerTrustSnapshot" JSONB,
    "termsAcceptedAt"    TIMESTAMP(3),
    "customerNote"       TEXT,
    "internalNote"       TEXT,
    "cancelledAt"        TIMESTAMP(3),
    "cancelReason"       TEXT,
    "cancelledBy"        TEXT,
    "completedAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
    -- The contract requires a positive price fixed before payment (gharar).
    CONSTRAINT "Appointment_quotedPrice_positive" CHECK ("quotedPrice" >= 0),
    -- A retainer cannot be negative, and a cancellation charge is documented
    -- cost, so it may never exceed the retainer actually taken.
    CONSTRAINT "Appointment_retainerAmount_nonneg" CHECK ("retainerAmount" >= 0),
    CONSTRAINT "Appointment_cancellationCost_nonneg" CHECK ("cancellationCost" >= 0)
);

-- The overlap query that makes a chair schedule work: "what is already booked
-- against this provider/resource that overlaps [from, to)". These two composite
-- indexes are the difference between an O(log n) check and a table scan.
CREATE INDEX "Appointment_businessId_startsAt_idx"     ON "Appointment"("businessId", "startsAt");
CREATE INDEX "Appointment_providerId_startsAt_endsAt_idx" ON "Appointment"("providerId", "startsAt", "endsAt");
CREATE INDEX "Appointment_resourceId_startsAt_endsAt_idx" ON "Appointment"("resourceId", "startsAt", "endsAt");
CREATE INDEX "Appointment_customerId_startsAt_idx"    ON "Appointment"("customerId", "startsAt");
CREATE INDEX "Appointment_businessId_status_startsAt_idx" ON "Appointment"("businessId", "status", "startsAt");

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "BusinessProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "BusinessResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Service snapshot on each appointment ─────────────────────────────────────

CREATE TABLE "AppointmentService" (
    "id"                  TEXT NOT NULL,
    "appointmentId"       TEXT NOT NULL,
    "serviceId"           TEXT NOT NULL,
    "nameAtBooking"       TEXT NOT NULL,
    "priceAtBooking"      DOUBLE PRECISION NOT NULL,
    "durationMinutes"     INTEGER NOT NULL,
    "retainerBpsAtBooking" INTEGER NOT NULL DEFAULT 0,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id"),
    -- The same service cannot be added twice to one appointment.
    CONSTRAINT "AppointmentService_appointmentId_serviceId_key" UNIQUE ("appointmentId", "serviceId")
);

ALTER TABLE "AppointmentService"
  ADD CONSTRAINT "AppointmentService_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Restrict, not Cascade: deleting a service that has been booked against would
-- destroy the record of what was sold. Services are deactivated instead.
ALTER TABLE "AppointmentService"
  ADD CONSTRAINT "AppointmentService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "BusinessService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Service escrow (held under amanah by a licensed rail) ────────────────────

CREATE TABLE "ServiceEscrow" (
    "id"                      TEXT NOT NULL,
    "businessId"              TEXT NOT NULL,
    "appointmentId"           TEXT NOT NULL,
    "rail"                    TEXT NOT NULL,
    "currency"                TEXT NOT NULL,
    "grossAmount"             DOUBLE PRECISION NOT NULL,
    "providerAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "providerCommissionBps"   INTEGER NOT NULL DEFAULT 0,
    "platformFee"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "railCost"                DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"                  TEXT NOT NULL DEFAULT 'PENDING',
    "fundedAt"                TIMESTAMP(3),
    "releasedAt"              TIMESTAMP(3),
    "refundedAt"              TIMESTAMP(3),
    "disputedAt"              TIMESTAMP(3),
    "railReference"           TEXT,
    "trustEventId"            TEXT,
    "settlementTerms"         JSONB,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEscrow_pkey" PRIMARY KEY ("id"),
    -- One escrow per booking. Without this, a retry or a double-submitted
    -- webhook could create a second escrow against the same appointment and the
    -- retainer could be released twice. The model declares @unique; this is the
    -- database half of that promise.
    CONSTRAINT "ServiceEscrow_appointmentId_key" UNIQUE ("appointmentId"),
    -- Money cannot be negative, and the provider cannot be paid more than was
    -- taken. These are the two ways a settlement bug becomes real money out.
    CONSTRAINT "ServiceEscrow_grossAmount_nonneg"     CHECK ("grossAmount" >= 0),
    CONSTRAINT "ServiceEscrow_providerAmount_nonneg"  CHECK ("providerAmount" >= 0),
    CONSTRAINT "ServiceEscrow_platformFee_nonneg"     CHECK ("platformFee" >= 0),
    CONSTRAINT "ServiceEscrow_provider_within_gross"  CHECK ("providerAmount" <= "grossAmount"),
    -- Commission is a share, so it cannot exceed the whole.
    CONSTRAINT "ServiceEscrow_commission_bps_range"   CHECK ("providerCommissionBps" >= 0 AND "providerCommissionBps" <= 10000)
);

CREATE INDEX "ServiceEscrow_businessId_status_idx" ON "ServiceEscrow"("businessId", "status");
CREATE INDEX "ServiceEscrow_status_createdAt_idx"  ON "ServiceEscrow"("status", "createdAt");

ALTER TABLE "ServiceEscrow"
  ADD CONSTRAINT "ServiceEscrow_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceEscrow"
  ADD CONSTRAINT "ServiceEscrow_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
