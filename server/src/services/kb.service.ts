import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class KbService {
  static async listPublishedArticles() {
    return prisma.kbArticle.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async searchArticles(query: string) {
    return prisma.kbArticle.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getArticleBySlug(slug: string) {
    return prisma.kbArticle.findUnique({
      where: { slug }
    });
  }
}
