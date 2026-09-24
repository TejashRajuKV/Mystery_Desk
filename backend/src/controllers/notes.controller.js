import * as service from '../services/notes.service.js';

export const listPrompts = (_req, res) => res.json(service.listPrompts());
export const consult = (req, res) => res.json(service.consult(req.body));
export const getFacts = (req, res) => res.json(service.discoveredFacts(req.params.suspectId));
