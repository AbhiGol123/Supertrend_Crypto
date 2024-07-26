// candlestick.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class CandlestickGateway {
  @WebSocketServer() server: Server;
}
