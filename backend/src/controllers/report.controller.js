import * as report from '../services/report.service.js';

export const getReport = (_req, res) => res.json(report.getReport());
