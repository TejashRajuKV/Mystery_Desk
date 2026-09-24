import { Router } from 'express';
import * as c from '../controllers/investigation.controller.js';

const router = Router();
router.get('/cases/:caseId/investigation', c.getInvestigation);
router.post('/cases/:caseId/viewed', c.recordViewed);
router.put('/cases/:caseId/theory', c.saveTheory);
router.post('/cases/:caseId/reset', c.resetInvestigation);
router.post('/cases/:caseId/contradictions', c.flagContradiction);
router.post('/cases/:caseId/conclusion', c.submitConclusion);
export default router;
