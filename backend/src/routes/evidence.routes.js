import { Router } from 'express';
import * as c from '../controllers/case.controller.js';

const router = Router();
router.get('/cases/:caseId/evidence', c.listEvidence);
router.get('/cases/:caseId/evidence/:evidenceId', c.getEvidence);
export default router;
