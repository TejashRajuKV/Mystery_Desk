import { Router } from 'express';
import * as c from '../controllers/notes.controller.js';

const router = Router();
router.get('/cases/:caseId/notes', c.listPrompts);
router.post('/cases/:caseId/notes', c.consult);
router.get('/cases/:caseId/facts/:suspectId', c.getFacts);
export default router;
