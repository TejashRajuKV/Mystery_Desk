import { Router } from 'express';
import * as c from '../controllers/report.controller.js';

const router = Router();
router.get('/cases/:caseId/report', c.getReport);
export default router;
