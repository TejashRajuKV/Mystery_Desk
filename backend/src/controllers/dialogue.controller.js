import * as service from '../services/dialogue.service.js';

export const getDialogue = (req, res) => res.json(service.getDialogueState(req.params.suspectId));
export const chooseDialogue = (req, res) => res.json(service.applyChoice(req.params.suspectId, req.body));
