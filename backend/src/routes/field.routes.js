import { Router } from 'express';
import * as c from '../controllers/field.controller.js';

const router = Router();
router.get('/cases/:caseId/file', c.getFile);
router.post('/cases/:caseId/file/:pageId/read', c.readPage);
router.get('/cases/:caseId/places', c.listPlaces);
router.post('/cases/:caseId/travel', c.travel);
router.get('/cases/:caseId/places/:locationId', c.getPlace);
router.post('/cases/:caseId/places/:locationId/search', c.search);
export default router;
