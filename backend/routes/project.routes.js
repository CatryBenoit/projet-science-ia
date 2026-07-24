const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const ProjectController = require('../controllers/project.controller');
const router = express.Router();

router.post('/', requireAuth, ProjectController.createProject);
router.get('/', requireAuth, ProjectController.getProjects);

router.post('/:id/synthesis', requireAuth, ProjectController.generateSynthesis);
router.get('/:id/synthesis', requireAuth, ProjectController.getSynthesis);

router.post('/:id/charts', requireAuth, ProjectController.addChart);
router.get('/:id/charts', requireAuth, ProjectController.getCharts);

router.get('/:id/graph', requireAuth, ProjectController.getGraph);
router.post('/:id/prune', requireAuth, ProjectController.pruneTopic);

module.exports = router;