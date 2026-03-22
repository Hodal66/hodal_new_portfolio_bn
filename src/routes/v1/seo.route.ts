import express from 'express';
import * as seoController from '../../controllers/seo.controller';

const router = express.Router();

// Publicly accessible SEO endpoints
router.get('/sitemap.xml', seoController.getSitemap);
router.get('/robots.txt', seoController.getRobots);

export default router;
