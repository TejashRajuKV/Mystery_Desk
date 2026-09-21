import * as assistant from '../services/assistant.service.js';

export const query = (req, res) => res.json(assistant.query(req.body));
