import { Router } from 'express';
import * as c from '../controllers/dialogue.controller.js';

const router = Router();
router.get('/cases/:caseId/dialogue/:suspectId', c.getDialogue);
router.post('/cases/:caseId/dialogue/:suspectId/choice', c.chooseDialogue);
export default router;
