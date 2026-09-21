import { Router } from 'express';
import { CASE_ID } from '../config/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import caseRoutes from './case.routes.js';
import evidenceRoutes from './evidence.routes.js';
import suspectsRoutes from './suspects.routes.js';
import timelineRoutes from './timeline.routes.js';
import connectionsRoutes from './connections.routes.js';
import investigationRoutes from './investigation.routes.js';
import assistantRoutes from './assistant.routes.js';
import reportRoutes from './report.routes.js';

const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true }));

api.use('/cases/:caseId', (req, _res, next) => {
  next(req.params.caseId === CASE_ID ? undefined : new HttpError(404, 'Case not found'));
});

for (const routes of [caseRoutes, evidenceRoutes, suspectsRoutes, timelineRoutes, connectionsRoutes, investigationRoutes, assistantRoutes, reportRoutes]) {
  api.use(routes);
}

export default api;
