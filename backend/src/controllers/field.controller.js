import * as service from '../services/field.service.js';

export const getFile = (_req, res) => res.json(service.getFile());
export const readPage = (req, res) => res.json(service.readPage(req.params.pageId));
export const listPlaces = (_req, res) => res.json(service.listPlaces());
export const getPlace = (req, res) => res.json(service.getPlace(req.params.locationId));
export const travel = (req, res) => res.json(service.travel(req.body));
export const search = (req, res) => res.json(service.search(req.params.locationId, req.body));
