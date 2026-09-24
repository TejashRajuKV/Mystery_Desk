import { Router } from 'express';
import * as c from '../controllers/case.controller.js';

const router = Router();
router.get('/cases', c.listCases);
router.get('/cases/:caseId', c.getCase);
export default router;
