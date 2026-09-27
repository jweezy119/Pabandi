import { Router } from 'express';
import { KbService } from '../services/kb.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (q) {
      const articles = await KbService.searchArticles(q as string);
      return res.json(articles);
    }
    const articles = await KbService.listPublishedArticles();
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const article = await KbService.getArticleBySlug(req.params.slug);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

export default router;
