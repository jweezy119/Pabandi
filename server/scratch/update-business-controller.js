const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/controllers/business.controller.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const newFunction = `

export const getBusinessCustomers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: { id }
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (business.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new CustomError('Not authorized', 403);
    }

    const reservations = await prisma.reservation.findMany({
      where: { businessId: id },
      // Include User data by joining on customerId if there is a relation.
      // Wait, let's check if Reservation has a relation to User.
      // In schema.prisma: customerId points to User? Let's verify.
      // In schema.prisma: model User { reservations Reservation[] }
      // In Reservation: No explicit relation field "customer User @relation(...)"?
      // Let's check schema.prisma again.
      // Wait, I didn't see the full Reservation model. Let's do raw query or manual join if no relation exists.
    });

    // Actually, let's just query users who have booked.
    // The safest way is to fetch reservations, then fetch users.
    const userIds = Array.from(new Set(reservations.map(r => r.customerId).filter(Boolean)));
    
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, reliabilityScore: true }
    });

    const userMap = new Map();
    users.forEach(u => userMap.set(u.id, u));

    const customerMap = new Map();

    reservations.forEach(r => {
      const cId = r.customerId;
      if (!cId) return;
      
      const user = userMap.get(cId);
      if (!user) return; // fallback to customerName/Phone if needed, but we want the user object

      if (!customerMap.has(cId)) {
        customerMap.set(cId, {
          user: user,
          totalBookings: 0,
          noShowCount: 0,
          totalSpend: 0,
          lastBookingDate: r.reservationDate,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          customerEmail: r.customerEmail
        });
      }
      
      const stats = customerMap.get(cId);
      stats.totalBookings += 1;
      if (r.status === 'NO_SHOW') stats.noShowCount += 1;
      if (r.depositAmount && r.depositPaid) stats.totalSpend += r.depositAmount;
      
      if (new Date(r.reservationDate) > new Date(stats.lastBookingDate)) {
        stats.lastBookingDate = r.reservationDate;
      }
    });

    const customers = Array.from(customerMap.values());

    res.json({
      success: true,
      data: { customers }
    });

  } catch (error) {
    next(error);
  }
};
`;

if (!content.includes('getBusinessCustomers')) {
  fs.appendFileSync(filePath, newFunction);
  console.log('Appended getBusinessCustomers to business.controller.ts');
} else {
  console.log('getBusinessCustomers already exists.');
}
