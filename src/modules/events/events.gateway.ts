import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { PrintJobStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  PrintJob,
  PrintJobDocument,
  PrinterAgentToken,
  PrinterAgentTokenDocument,
} from '../printers/printer.schemas';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectModel(PrinterAgentToken.name)
    private readonly agentTokenModel: Model<PrinterAgentTokenDocument>,
    @InjectModel(PrintJob.name)
    private readonly printJobModel: Model<PrintJobDocument>,
  ) {}

  private async authenticateAgent(client: Socket, agentToken: string) {
    const agent = await this.agentTokenModel
      .findOne({ token: agentToken, isActive: true })
      .exec();
    if (!agent) {
      client.disconnect(true);
      return false;
    }
    const rid = String(agent.restaurantId);
    client.data.agent = true;
    client.data.restaurantId = rid;
    client.data.organizationId = String(agent.organizationId);
    await client.join(`agent:${rid}`);
    await client.join(`restaurant:${rid}`);
    agent.lastSeenAt = new Date();
    await agent.save();
    this.logger.log(`Agent connected for restaurant ${rid}`);
    return true;
  }

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth ?? {};
      const isAgentType = auth.type === 'printer-agent';
      const agentToken =
        (auth.agentToken as string | undefined) ||
        (isAgentType ? (auth.token as string | undefined) : undefined) ||
        (client.handshake.headers['x-agent-token'] as string | undefined);
      const token =
        (!isAgentType ? (auth.token as string | undefined) : undefined) ||
        (client.handshake.headers.authorization?.replace('Bearer ', '') as
          | string
          | undefined);

      if (agentToken) {
        await this.authenticateAgent(client, agentToken);
        return;
      }

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      client.data.user = payload;
      client.data.restaurantId = payload.restaurantId;
      if (payload.restaurantId) {
        await client.join(`restaurant:${payload.restaurantId}`);
        await client.join(`kitchen:${payload.restaurantId}`);
      }
      this.logger.log(`User ${payload.userId} connected`);
    } catch (e) {
      this.logger.warn(`WS auth failed: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const allowedPrefixes = ['restaurant:', 'kitchen:', 'agent:'];
    if (!body?.room || !allowedPrefixes.some((p) => body.room.startsWith(p))) {
      return { ok: false };
    }
    const rid = client.data.restaurantId as string | undefined;
    if (
      rid &&
      !body.room.endsWith(rid) &&
      !String(client.data.user?.role || '').includes('OWNER')
    ) {
      return { ok: false };
    }
    void client.join(body.room);
    return { ok: true, room: body.room };
  }

  @SubscribeMessage('agent:register')
  handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { restaurantId?: string },
  ) {
    if (!client.data.agent) return { ok: false };
    const rid = client.data.restaurantId as string;
    if (body?.restaurantId && body.restaurantId !== rid) {
      return { ok: false };
    }
    void client.join(`agent:${rid}`);
    return { ok: true, restaurantId: rid };
  }

  @SubscribeMessage('print:ack')
  async handlePrintAck(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId: string; status: 'PRINTED' | 'FAILED'; error?: string },
  ) {
    if (!client.data.agent || !body?.jobId) return { ok: false };
    const job = await this.printJobModel.findById(body.jobId).exec();
    if (!job) return { ok: false };
    if (String(job.restaurantId) !== String(client.data.restaurantId)) {
      return { ok: false };
    }
    if (body.status === 'PRINTED') {
      job.status = PrintJobStatus.PRINTED;
      job.ackedAt = new Date();
      job.lastError = undefined;
    } else {
      job.status = PrintJobStatus.FAILED;
      job.lastError = body.error || 'Print failed';
      job.attempts += 1;
    }
    await job.save();
    this.emitToRestaurant(String(job.restaurantId), 'PRINTER_JOB_COMPLETED', {
      jobId: body.jobId,
      status: job.status,
      error: job.lastError,
    });
    return { ok: true };
  }

  emitToRestaurant(restaurantId: string, event: string, payload: unknown) {
    this.server.to(`restaurant:${restaurantId}`).emit(event, payload);
  }

  emitToKitchen(restaurantId: string, event: string, payload: unknown) {
    this.server.to(`kitchen:${restaurantId}`).emit(event, payload);
  }

  emitToAgent(restaurantId: string, event: string, payload: unknown) {
    this.server.to(`agent:${restaurantId}`).emit(event, payload);
  }
}
