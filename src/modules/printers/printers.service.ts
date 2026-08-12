import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrintJobStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { EventsGateway } from '../events/events.gateway';
import {
  Printer,
  PrinterDocument,
  PrintJob,
  PrintJobDocument,
} from './printer.schemas';
import { CreatePrinterDto, UpdatePrinterDto } from './printers.dto';

@Injectable()
export class PrintersService {
  constructor(
    @InjectModel(Printer.name) private readonly printerModel: Model<PrinterDocument>,
    @InjectModel(PrintJob.name) private readonly jobModel: Model<PrintJobDocument>,
    private readonly events: EventsGateway,
  ) {}

  async create(user: JwtPayload, dto: CreatePrinterDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    return this.printerModel.create({
      name: dto.name,
      productionCenter: dto.productionCenter,
      connectionString: dto.connectionString,
      ip: dto.ip || '127.0.0.1',
      port: dto.port ?? 9100,
      ...tenant,
      isActive: true,
    });
  }

  list(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    return this.printerModel.find({ ...tenant }).sort({ name: 1 }).exec();
  }

  async update(user: JwtPayload, id: string, dto: UpdatePrinterDto) {
    const doc = await this.printerModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Printer not found');
    if (dto.name) doc.name = dto.name;
    if (dto.connectionString !== undefined) doc.connectionString = dto.connectionString;
    if (dto.ip !== undefined) doc.ip = dto.ip;
    if (dto.port !== undefined) doc.port = dto.port;
    if (dto.productionCenter !== undefined) doc.productionCenter = dto.productionCenter;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    return doc;
  }

  async remove(user: JwtPayload, id: string) {
    const doc = await this.printerModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Printer not found');
    doc.isActive = false;
    await doc.save();
    return { ok: true };
  }

  listJobs(user: JwtPayload, restaurantId?: string, status?: PrintJobStatus) {
    const tenant = tenantFilter(user, restaurantId);
    const q: Record<string, unknown> = { ...tenant };
    if (status) q.status = status;
    return this.jobModel.find(q).sort({ createdAt: -1 }).limit(100).exec();
  }

  async retry(user: JwtPayload, id: string) {
    const job = await this.jobModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!job) throw new NotFoundException('Print job not found');
    job.status = PrintJobStatus.PENDING;
    job.attempts += 1;
    job.lastError = undefined;
    await job.save();
    this.events.emitToAgent(String(job.restaurantId), 'PRINTER_JOB_RETRY', job);
    return job;
  }

  async ack(user: JwtPayload, id: string) {
    const job = await this.jobModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!job) throw new NotFoundException('Print job not found');
    job.status = PrintJobStatus.ACKED;
    job.ackedAt = new Date();
    await job.save();
    this.events.emitToRestaurant(String(job.restaurantId), 'PRINTER_JOB_ACKED', {
      jobId: id,
    });
    return job;
  }
}
