import { Router } from 'express';
import * as c from '../controllers/investigation.controller.js';

const router = Router();
router.get('/cases/:caseId/connections', c.listConnections);
router.post('/cases/:caseId/connections', c.createConnection);
router.delete('/connections/:connectionId', c.deleteConnection);
export default router;
