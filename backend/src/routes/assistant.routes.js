import { Router } from 'express';
import * as c from '../controllers/assistant.controller.js';

const router = Router();
router.post('/assistant/query', c.query);
export default router;
