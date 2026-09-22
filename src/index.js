import http from 'http'; //(needed so Express and WebSocket can share one port).
import { matchRouter } from './routes/matches.js';
import express from 'express';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from '../arcjet.js';
import { commentaryRouter } from './routes/commentary.js';
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; 

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.get('/', (req, res) => {
  res.send('Hello from express server!');
});

app.use(securityMiddleware());
app.use('/matches', matchRouter);
app.use('/matches/:id/commentary', commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary } = attachWebSocketServer(server);

app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

server.listen(PORT, HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket Server is running on ${baseUrl.replace('http', 'ws')}/ws`);
});
