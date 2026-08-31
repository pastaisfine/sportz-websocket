import { eq } from 'drizzle-orm';
import { db, pool } from './db/db.js';
import { matchRouter } from './routes/matches.js';

import express from 'express';
const app = express();

app.use(express.json());
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use('/matches', matchRouter);

app.listen(8080, () => {
  console.log('Server listening on port 8080');
});