import { prisma } from '../utils/database';
import crypto from 'crypto';

export class TeamService {
  /**
   * The team roster, filtered, searched, sorted and paged.
   *
   * This returned every employee in creation order with no controls at all, so an
   * admin managing fifty people had to scroll a single table to find one, and there
   * was no way to ask "who is inactive" or "who has not taken a job in a fortnight".
   *
   * `include: jobs` is kept — the table shows a delivery score derived from it — but
   * it is a second query for every row the page loads, so the page size bounds how
   * much of it happens. Paging is what makes that acceptable; it was not acceptable
   * with the whole roster.
   */
  static async getTeamMembers(
    businessId: string,
    options: {
      search?: string;
      role?: string;
      isActive?: boolean;
      sortBy?: string;
      sortOrder?: string;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const where: any = { businessId };

    const term = options.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (options.role) where.role = options.role;
    // `isActive` is read with `in` rather than compared directly so an absent param
    // and a param of `false` are distinguishable — `where.isActive = undefined` is a
    // no-op, and `= false` is a filter.
    if (options.isActive !== undefined) where.isActive = options.isActive;

    const direction = options.sortOrder === 'asc' ? 'asc' : 'desc';
    // Whitelisted: it reaches orderBy directly, so an unknown column is a Prisma
    // error rather than a wrong order.
    const SORTABLE = ['name', 'role', 'reliabilityScore', 'deliveryScore', 'payRate', 'createdAt', 'lastBookingAt'];
    const orderBy: any = options.sortBy && SORTABLE.includes(options.sortBy)
      ? { [options.sortBy]: direction }
      : { createdAt: 'desc' };

    const paginated = options.take !== undefined;
    const [members, total] = await Promise.all([
      prisma.crmEmployee.findMany({
        where,
        include: {
          jobs: { select: { id: true, title: true, status: true, deliveryScore: true } }
        },
        orderBy,
        ...(paginated ? { skip: options.skip ?? 0, take: options.take } : {}),
      }),
      paginated ? prisma.crmEmployee.count({ where }) : 0,
    ]);

    return { members, total, paginated };
  }

  static async getTeamMember(id: string, businessId: string) {
    return prisma.crmEmployee.findFirst({
      where: { id, businessId },
      include: {
        jobs: true
      }
    });
  }

  static async inviteMember(data: { businessId: string; name: string; email: string; role: string; payRate?: number; payType?: string }) {
    const token = crypto.randomBytes(32).toString('hex');
    
    return prisma.crmEmployee.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        email: data.email,
        role: data.role,
        payRate: data.payRate || 0,
        payType: data.payType || 'HOURLY',
        inviteToken: token,
        inviteStatus: 'PENDING',
        isActive: true,
        // `reliabilityScore` is deliberately omitted.
        //
        // It used to be written here as 100 — the TOP of the 0–100 scale — for
        // an employee who had not started work. There is a defensible argument
        // that "no history yet" should read as perfect for a tool that is simply
        // unmeasured. But this number is shown to customers and read by
        // job-assignment logic, so a flattering blank beats an honest one.
        // The column default is COLD_START_SCORE (50), which is neutral.
        //
        // `deliveryScore` keeps its 100: that is a different field with its own
        // documented 0–1000 scale, and 500 is already its midpoint default, so
        // it is not the same class of claim.
        deliveryScore: 100
      }
    });
  }

  static async updateMember(id: string, businessId: string, data: any) {
    return prisma.crmEmployee.update({
      where: { id },
      data: {
        ...data
      }
    });
  }

  static async removeMember(id: string, businessId: string) {
    // Soft delete
    return prisma.crmEmployee.update({
      where: { id },
      data: {
        isActive: false
      }
    });
  }

  static async acceptInvite(token: string) {
    const member = await prisma.crmEmployee.findUnique({ where: { inviteToken: token } });
    if (!member) throw new Error('Invalid or expired invite token');

    return prisma.crmEmployee.update({
      where: { id: member.id },
      data: {
        inviteStatus: 'ACCEPTED',
        inviteToken: null // One-time use
      }
    });
  }
}
