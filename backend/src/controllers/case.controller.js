import * as service from '../services/case.service.js';

export const getCase = (_req, res) => res.json(service.getCase());
export const listEvidence = (_req, res) => res.json(service.listEvidence());
export const getEvidence = (req, res) => res.json(service.getEvidence(req.params.evidenceId));
export const listSuspects = (_req, res) => res.json(service.listSuspects());
export const getSuspect = (req, res) => res.json(service.getSuspect(req.params.suspectId));
export const listStatements = (_req, res) => res.json(service.listStatements());
export const listTimeline = (_req, res) => res.json(service.listTimeline());
