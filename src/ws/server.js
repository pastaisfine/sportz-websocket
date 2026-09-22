import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if(!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if(!subscribers) return;

    subscribers.delete(socket);

    if(subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket) {
    for(const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

//WebSockets only send text, so we convert an object to a JSON string (JSON.stringify)
function sendJson(socket, payload) {
    if(socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

//send to anyone
function broadcastToAll(wss, payload) { 
    for (const client of wss.clients)  {
        if(client.readyState !== WebSocket.OPEN) continue;
        // skip anyone not open

        client.send(JSON.stringify(payload));
    }
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    if(!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for(const client of subscribers) {
        if(client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
        return;
    }

    if(message?.type === "subscribe" && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId });
        return;
    }

    if(message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId });
    }
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 });
                                                        // limits incoming messages to 1 MB so nobody can blow up memory.

    wss.on('connection', async (ws, req) => {

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    if (decision.reason.isRateLimit()) {
                        ws.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
                    } else {
                        ws.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    }
                    ws.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade protection error', e);
                ws.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                ws.destroy();
                return;
            }
        }

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        sendJson(ws, { type: 'welcome' });
        ws.on('error', console.error);

        ws.subscriptions = new Set();
        ws.on('message', (data) => handleMessage(ws, data));
        ws.on('error', (err) => {
            ws.terminate();
        });
        ws.on('close', () => {
            cleanupSubscriptions(ws);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            // it means we pinged them last round and they never answered 
            // → they're a zombie connection (e.g., laptop closed, wifi dropped)

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });


    function broadcastMatchCreated(match){
        broadcastToAll(wss, { type: 'matchCreated', data: match });
    }

    function broadcastCommentary(matchId, comment) {
        broadcastToMatch(matchId, { type: 'commentary', data: comment });
    }

    return { broadcastMatchCreated, broadcastCommentary, wss };
}