import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../../arcjet.js";

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
        broadcastToAll(wss, { event: 'matchCreated', data: match });
    }

    return { broadcastMatchCreated, wss };
}