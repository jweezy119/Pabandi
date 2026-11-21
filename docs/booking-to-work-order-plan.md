# Bookings → Work Orders — spec

The coordinator is empty for exactly the businesses it is for. `WorkOrder` rows are
only ever created by hand, so a shop taking bookings through `/book/:id` sees
"Nothing yet" forever. This is the fix that makes the Service Coordinator useful
to a business like DMG Motors.

## 1. The problem in one line

A booking and a work order are the same real-world thing — a customer, a job, a
time, an address — stored twice, and nothing connects them.

## 2. What exists

**`Booking`** (created by `POST /api/v1/booking`, `booking.routes.ts:732`):

```
businessId, clientId -> CrmClient, slotStart, slotEnd, serviceType,
depositAmount, depositStatus, status ('pending' | 'confirmed' | ...),
clientAddress, metadata { customerName, customerEmail, specialRequests,
projectDescription, serviceName, drpe, ... }
```

**`WorkOrder`** (coordinator):

```
businessId, customerId -> Customer, status (PENDING_ASSIGNMENT is the entry
state), priority (EMERGENCY | URGENT | ROUTINE), issueType, description,
address, accessNotes, scheduledFor, createdById
```

**The mismatch that matters:** a booking's customer is a `CrmClient`; a work
order's customer is a `Customer`. They are different tables.

## 3. Design

### 3.1 When a work order is created

**At booking creation.** Not on payment, not on confirmation.

A booking that has not paid its deposit is still a real job request — somebody
asked for a time. Hiding it until payment means the coordinator is empty during
exactly the window where the business most needs to plan. The deposit state is
already visible on the booking and can be carried into the description.

### 3.2 The link, and idempotency

Add to `Booking`:

```prisma
workOrderId String? @unique
```

`@unique` is the idempotency mechanism: at most one work order per booking, and a
retry cannot create a second. Claim it atomically rather than read-then-write:

```ts
const claimed = await prisma.booking.updateMany({
  where: { id: booking.id, workOrderId: null },
  data: { workOrderId: 'pending' },
});
if (claimed.count === 0) return; // another attempt already took it
```

Then create the work order and write its id back.

### 3.3 The customer problem

Two options:

**(a) Resolve a `Customer` from the booking's `CrmClient`.** Match on
`businessId + email`, falling back to `businessId + name`. Create one if neither
matches. No schema change to `WorkOrder`; the coordinator keeps working exactly as
it does today.

**(b) Repoint `WorkOrder.customerId` at `CrmClient`.** Cleaner long-term — one
customer table, and `CrmClient` already links bookings and invoices — but it
touches every coordinator query, the `/coordinator/customers` endpoint, and the
customer picker in the new-work-order dialog.

**Recommendation: (a) now, (b) later.** (a) is small and reversible; (b) is the
right end state but is a migration of a surface that is currently being used.

### 3.4 Field mapping

| WorkOrder | Source | Note |
|---|---|---|
| `businessId` | `booking.businessId` | |
| `customerId` | resolved `Customer` (§3.3) | |
| `status` | `PENDING_ASSIGNMENT` | the assign step is the coordinator's value |
| `priority` | same-day → `URGENT`, otherwise `ROUTINE` | never `EMERGENCY` — nothing in a booking justifies it |
| `issueType` | `booking.serviceType` | |
| `description` | `serviceName` + `specialRequests` / `projectDescription` | plain language, no JSON |
| `address` | `booking.clientAddress` | |
| `accessNotes` | `specialRequests` | |
| `scheduledFor` | `booking.slotStart` | |
| `createdById` | the business owner | it is a system-created row |

Never write raw `metadata` JSON into `description` — a business owner should be
able to read the work order without a parser.

### 3.5 Cancellation

When a booking is cancelled, mark its work order `CANCELLED`. A cancelled booking
with no work order (created before this shipped) is ignored.

## 4. What the coordinator then shows

`GET /coordinator/work-orders` already shapes the response. Add to it:

- the source booking id, so the two can be opened from each other;
- the deposit state, so the owner can see "not paid yet" without opening anything.

## 5. Build order

1. **Schema + migration** — `Booking.workOrderId`. `db push` cannot be used here;
   this needs a real migration like the outreach one, because production runs
   `prisma migrate deploy`.
2. **A service, not a route** — `bookingWorkOrder.service.ts`, pure where
   possible, so the mapping and the customer resolution are testable without a
   database.
3. **Call it from the booking creation path**, after the booking row exists.
4. **Cancellation hook.**
5. **Coordinator shaping** — include the booking link and deposit state.
6. **Tests** — mapping, idempotency (a second call creates nothing), and customer
   resolution (match by email, fall back to name, create when absent).

## 6. Open questions

- **Existing bookings.** Backfill, or only new ones? Recommend **new only** — a
  backfill would create a coordinator full of stale jobs from before the business
  started using it.
- **Deposits.** Should a work order for an unpaid deposit booking be visually
  distinct? Recommend yes — it is the single most useful thing an owner needs to
  see in the morning.
- **Editing.** If a customer rebooks to a different time, does the work order move?
  Recommend yes — `scheduledFor` follows the booking.
