import { Router } from 'express';
import * as c from '../controllers/assistant.controller.js';

const router = Router();
router.post('/cases/:caseId/assistant/query', c.query);
export default router;
