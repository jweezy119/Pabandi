import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Bookings -> work orders, against a real database.
 *
 * The pure mapping is covered by bookingWorkOrder.test.ts. This file exists for
 * the half that cannot be checked without a database: the atomic claim, the
 * CrmClient -> Customer resolution, and the cancellation path. CI's `verify` job
 * runs it against a throwaway Postgres; locally it refuses to run without a
 * disposable DATABASE_URL, which is the point.
 */

process.env.JWT_SECRET = 'test-jwt-secret';

function assertIsolatedDatabase() {
  const url = process.env.DATABASE_URL || '';
  let name = '';
  try {
    name = new URL(url).pathname.replace(/^\//, '');
  } catch {
    /* handled below */
  }
  if (!/test|integration|ci/i.test(name)) {
    throw new Error(
      `Refusing to run integration tests against database "${name || '<unknown>'}"\n` +
        'These tests write and delete real rows. Point DATABASE_URL at a disposable ' +
        'database whose name contains "test".',
    );
  }
  return name;
}

const MARKER = '@workorder.pabandi.dev';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const dbName = assertIsolatedDatabase();
  const { default: app } = await import('../src/index');
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { prisma } = await import('../src/utils/database');
  const probe = await prisma.user.count();
  console.log(`[integration] database "${dbName}" reachable, ${probe} users`);
  process.env.SMOKE_TEST_BASE_URL = baseUrl;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const { prisma } = await import('../src/utils/database');
  await prisma.$disconnect();
});

describe('bookings create work orders', () => {
  let businessId: string;
  let clientId: string;
  let bookingId: string;

  beforeEach(async () => {
    const { prisma } = await import('../src/utils/database');
    await prisma.workOrder.deleteMany({ where: { businessId: { contains: MARKER } } });
    await prisma.booking.deleteMany({ where: { businessId: { contains: MARKER } } });
    await prisma.customer.deleteMany({ where: { businessId: { contains: MARKER } } });
    await prisma.crmClient.deleteMany({ where: { businessId: { contains: MARKER } } });
    await prisma.business.deleteMany({ where: { id: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });

    const user = await prisma.user.create({
      data: { email: `owner${MARKER}`, firstName: 'Owner' },
    });
    const business = await prisma.business.create({
      data: {
        id: `biz_${MARKER.replace('@', '').replace(/\./g, '_')}`,
        ownerId: user.id,
        name: 'DMG Motors',
        category: 'OTHER',
        address: '1 Shop Lane',
      },
    });
    businessId = business.id;

    const client = await prisma.crmClient.create({
      data: {
        businessId,
        name: 'Ada Lovelace',
        email: `ada${MARKER}`,
        stage: 'ACTIVE',
      },
    });
    clientId = client.id;

    const booking = await prisma.booking.create({
      data: {
        businessId,
        clientId,
        slotStart: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        slotEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        serviceType: 'Inspection',
        status: 'confirmed',
        clientAddress: '221B Baker Street',
      },
    });
    bookingId = booking.id;
  });

  it('creates a work order and links it back to the booking', async () => {
    const { createWorkOrderForBooking } = await import(
      '../src/services/bookingWorkOrder.service'
    );

    const workOrderId = await createWorkOrderForBooking(
      {
        bookingId,
        businessId,
        serviceType: 'Inspection',
        serviceName: 'Brake inspection',
        notes: 'Customer hears a noise',
        address: '221B Baker Street',
        slotStart: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdById: 'test',
      },
      { name: 'Ada Lovelace', email: `ada${MARKER}` },
    );

    expect(workOrderId).toBeTruthy();

    const { prisma } = await import('../src/utils/database');
    const linked = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { workOrderId: true },
    });
    expect(linked?.workOrderId).toBe(workOrderId);

    const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId! } });
    expect(workOrder?.status).toBe('PENDING_ASSIGNMENT');
    expect(workOrder?.priority).toBe('ROUTINE');
    expect(workOrder?.description).toContain('Brake inspection');
    expect(workOrder?.description).toContain('Customer hears a noise');
  });

  it('is idempotent — a second call creates nothing', async () => {
    const { createWorkOrderForBooking } = await import(
      '../src/services/bookingWorkOrder.service'
    );
    const source = {
      bookingId,
      businessId,
      serviceType: 'Inspection',
      address: '221B Baker Street',
      slotStart: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      createdById: 'test',
    };
    const client = { name: 'Ada Lovelace', email: `ada${MARKER}` };

    const first = await createWorkOrderForBooking(source, client);
    const second = await createWorkOrderForBooking(source, client);

    expect(first).toBeTruthy();
    expect(second).toBeNull();

    const { prisma } = await import('../src/utils/database');
    const count = await prisma.workOrder.count({ where: { businessId } });
    expect(count).toBe(1);
  });

  it('resolves the coordinator Customer from the booking’s CrmClient', async () => {
    const { createWorkOrderForBooking } = await import(
      '../src/services/bookingWorkOrder.service'
    );
    await createWorkOrderForBooking(
      {
        bookingId,
        businessId,
        serviceType: 'Inspection',
        address: '221B Baker Street',
        slotStart: new Date(),
        createdById: 'test',
      },
      { name: 'Ada Lovelace', email: `ada${MARKER}` },
    );

    const { prisma } = await import('../src/utils/database');
    const customers = await prisma.customer.findMany({ where: { businessId } });
    // One person, one row — matched by email, not duplicated by name.
    expect(customers).toHaveLength(1);
    expect(customers[0].email).toBe(`ada${MARKER}`);
  });

  it('cancelling the booking cancels an unfinished work order', async () => {
    const { createWorkOrderForBooking, cancelWorkOrderForBooking } = await import(
      '../src/services/bookingWorkOrder.service'
    );
    await createWorkOrderForBooking(
      {
        bookingId,
        businessId,
        serviceType: 'Inspection',
        address: '221B Baker Street',
        slotStart: new Date(),
        createdById: 'test',
      },
      { name: 'Ada Lovelace', email: `ada${MARKER}` },
    );

    await cancelWorkOrderForBooking(bookingId);

    const { prisma } = await import('../src/utils/database');
    const workOrder = await prisma.workOrder.findFirst({ where: { businessId } });
    expect(workOrder?.status).toBe('CANCELLED');
  });

  it('leaves no orphan link when the customer cannot be resolved', async () => {
    const { createWorkOrderForBooking } = await import(
      '../src/services/bookingWorkOrder.service'
    );
    const result = await createWorkOrderForBooking(
      {
        bookingId,
        businessId,
        serviceType: 'Inspection',
        address: '221B Baker Street',
        slotStart: new Date(),
        createdById: 'test',
      },
      // No name and no email: there is nobody to attach the work order to.
      { name: null, email: null },
    );

    expect(result).toBeNull();

    const { prisma } = await import('../src/utils/database');
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { workOrderId: true },
    });
    // Released, not left as 'pending' — otherwise every later attempt would be
    // blocked by a claim that can never be satisfied.
    expect(booking?.workOrderId).toBeNull();
  });
});
