const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const ProjectController = require('../controllers/project.controller');
const router = express.Router();

router.get('/users-list', requireAuth, ProjectController.getAvailableUsers);

router.post('/', requireAuth, ProjectController.createProject);
router.get('/', requireAuth, ProjectController.getProjects);

router.post('/:id/synthesis', requireAuth, ProjectController.generateSynthesis);
router.get('/:id/synthesis', requireAuth, ProjectController.getSynthesis);

router.post('/:id/charts', requireAuth, ProjectController.addChart);
router.get('/:id/charts', requireAuth, ProjectController.getCharts);

//router.get('/:id/graph', requireAuth, ProjectController.getGraph);
router.post('/:id/prune', requireAuth, ProjectController.pruneTopic);

// Gestion des discussions / notes partagées
router.get('/:id/notes', requireAuth, ProjectController.getProjectNotes);
router.post('/:id/notes', requireAuth, ProjectController.addProjectNote); 


router.get('/:id/pending-queries', requireAuth, ProjectController.getPendingQueries);

router.get('/:id', requireAuth, ProjectController.getProjectById);

router.get('/:id/graph', requireAuth, ProjectController.getGraphData);

router.post('/:id/chat', requireAuth, ProjectController.askChatbot);


router.get('/:id/members', requireAuth, ProjectController.getProjectMembers);
router.post('/:id/members', requireAuth, ProjectController.addProjectMember);
router.delete('/:id/members/:userId', requireAuth, ProjectController.removeProjectMember);
 
router.get('/:id/stats', requireAuth, ProjectController.getProjectStats);
 
module.exports = router;