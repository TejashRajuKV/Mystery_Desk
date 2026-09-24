import { Router } from 'express';
import { inCase } from '../database/caseScope.js';
import { caseExists } from '../models/case.model.js';
import { HttpError } from '../middleware/errorHandler.js';
import caseRoutes from './case.routes.js';
import evidenceRoutes from './evidence.routes.js';
import suspectsRoutes from './suspects.routes.js';
import timelineRoutes from './timeline.routes.js';
import connectionsRoutes from './connections.routes.js';
import investigationRoutes from './investigation.routes.js';
import assistantRoutes from './assistant.routes.js';
import reportRoutes from './report.routes.js';
import dialogueRoutes from './dialogue.routes.js';
import notesRoutes from './notes.routes.js';
import fieldRoutes from './field.routes.js';

const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true }));

// Everything under /cases/:caseId runs with that case in scope; an unknown case is a 404.
api.use('/cases/:caseId', (req, _res, next) => {
  if (!caseExists(req.params.caseId)) return next(new HttpError(404, 'Case not found'));
  return inCase(req.params.caseId, () => next());
});

for (const routes of [caseRoutes, evidenceRoutes, suspectsRoutes, timelineRoutes, connectionsRoutes, investigationRoutes, assistantRoutes, reportRoutes, dialogueRoutes, notesRoutes, fieldRoutes]) {
  api.use(routes);
}

export default api;
