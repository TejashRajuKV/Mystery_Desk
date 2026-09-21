import express from 'express';
import { PORT } from './config/index.js';
import { seed } from './database/seed.js';
import api from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

console.log('Case data loaded:', seed());

const app = express();
app.use(express.json());
app.use('/api', api);
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => console.log(`MysteryDesk API listening on http://localhost:${PORT}`));
