const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const LibraryController = require('../controllers/library.controller');
const router = express.Router();

router.get('/articles', requireAuth, LibraryController.getArticles);
router.get('/projects/:projectId/articles', requireAuth, LibraryController.getProjectArticles);
router.get('/articles/:id/content', requireAuth, LibraryController.getArticleContent);
router.post('/articles/:id/analyze', requireAuth, LibraryController.analyzeArticle);
router.get('/articles/:id/analysis', requireAuth, LibraryController.getArticleAnalysis);

module.exports = router;