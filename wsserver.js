import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 1234 });

wss.on('connection', function connection(ws) {
  console.log('new client connected');

  ws.on('error', console.error);

  ws.on('message', function message(data) {
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  // ws.send('something');
});
