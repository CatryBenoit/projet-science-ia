const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const LibraryController = require('../controllers/library.controller');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Les fichiers iront dans le dossier data/articles/
        cb(null, path.join(__dirname, '../services/data/articles/'));
    },
    filename: (req, file, cb) => {
        // On nettoie le nom du fichier pour éviter les problèmes d'espaces
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, Date.now() + '_' + safeName);
    }
});

const upload = multer({ storage: storage });

router.get('/articles', requireAuth, LibraryController.getArticles);
router.get('/projects/:projectId/articles', requireAuth, LibraryController.getProjectArticles);
router.get('/articles/:id/content', requireAuth, LibraryController.getArticleContent);
router.post('/articles/:id/analyze', requireAuth, LibraryController.analyzeArticle);
router.get('/articles/:id/analysis', requireAuth, LibraryController.getArticleAnalysis);

router.post('/projects/:id/upload', requireAuth, upload.single('file'), LibraryController.uploadArticle);

router.post('/projects/:id/video', requireAuth, LibraryController.addVideoLink);


module.exports = router;