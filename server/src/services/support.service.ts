import { PrismaClient } from '@prisma/client';
import { notifySupportReply } from './notification.service';

const prisma = new PrismaClient();

export class SupportService {
  static async createTicket(userId: string, businessId: string, data: { subject: string; category: string; description: string; priority: string }) {
    return prisma.supportTicket.create({
      data: {
        userId,
        businessId,
        subject: data.subject,
        category: data.category,
        description: data.description,
        priority: data.priority,
        status: 'Open'
      }
    });
  }

  static async listUserTickets(userId: string, businessId: string) {
    return prisma.supportTicket.findMany({
      where: { userId, businessId },
      include: { assignedTo: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async listAllTicketsAdmin(businessId: string) {
    return prisma.supportTicket.findMany({
      where: { businessId },
      include: { user: true, assignedTo: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getTicket(ticketId: string, businessId: string) {
    return prisma.supportTicket.findFirst({
      where: { id: ticketId, businessId },
      include: { 
        replies: {
          include: { author: true },
          orderBy: { createdAt: 'asc' }
        },
        user: true,
        assignedTo: true
      }
    });
  }

  static async replyToTicket(ticketId: string, authorId: string, body: string, isInternal = false) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { user: true } });
    const reply = await prisma.supportReply.create({
      data: {
        ticketId,
        authorId,
        body,
        isInternal
      }
    });

    if (ticket && ticket.userId && !isInternal) {
      await notifySupportReply(ticket.userId, ticketId, ticket.subject);
    }

    return reply;
  }

  static async resolveTicket(ticketId: string) {
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'Resolved', resolvedAt: new Date() }
    });
  }

  static async assignTicket(ticketId: string, assignedToId: string) {
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId }
    });
  }
}
