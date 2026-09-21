import * as service from '../services/investigation.service.js';

export const getInvestigation = (_req, res) => res.json(service.getInvestigation());
export const recordViewed = (req, res) => res.json(service.recordViewed(req.body));
export const saveTheory = (req, res) => res.json(service.saveTheory(req.body));
export const flagContradiction = (req, res) => res.json(service.flagContradiction(req.body));
export const submitConclusion = (req, res) => res.json(service.submitConclusion(req.body));

export const listConnections = (_req, res) => res.json(service.listConnections());
export const createConnection = (req, res) => res.status(201).json(service.createConnection(req.body));
export const deleteConnection = (req, res) => {
  service.deleteConnection(req.params.connectionId);
  res.status(204).end();
};
