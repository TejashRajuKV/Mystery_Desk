import { Router } from 'express';
import * as c from '../controllers/case.controller.js';

const router = Router();
router.get('/cases/:caseId/suspects', c.listSuspects);
router.get('/cases/:caseId/statements', c.listStatements);
router.get('/cases/:caseId/suspects/:suspectId', c.getSuspect);
export default router;
