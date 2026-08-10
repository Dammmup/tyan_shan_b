import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CashOpType, PaymentMethod, ShiftStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { Payment, PaymentDocument } from '../payments/payment.schemas';
import {
  CashOperation,
  CashOperationDocument,
  Shift,
  ShiftDocument,
} from './shift.schemas';
import { CashOperationDto, CloseShiftDto, OpenShiftDto } from './shifts.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift.name) private readonly shiftModel: Model<ShiftDocument>,
    @InjectModel(CashOperation.name)
    private readonly cashModel: Model<CashOperationDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly audit: AuditService,
  ) {}

  async open(user: JwtPayload, dto: OpenShiftDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    const existing = await this.shiftModel
      .findOne({ ...tenant, status: ShiftStatus.OPEN })
      .exec();
    if (existing) {
      throw new BadRequestException('Shift already open');
    }
    const shift = await this.shiftModel.create({
      ...tenant,
      openedBy: toObjectId(user.userId),
      status: ShiftStatus.OPEN,
      openingCashTiyns: Math.trunc(dto.openingCashTiyns),
      openedAt: new Date(),
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.userId,
      action: 'SHIFT_OPEN',
      entityType: 'Shift',
      entityId: String(shift._id),
    });
    return shift;
  }

  async current(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    return this.shiftModel.findOne({ ...tenant, status: ShiftStatus.OPEN }).exec();
  }

  async close(user: JwtPayload, id: string, dto: CloseShiftDto) {
    const shift = await this.shiftModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
        status: ShiftStatus.OPEN,
      })
      .exec();
    if (!shift) throw new NotFoundException('Open shift not found');

    const payments = await this.paymentModel.find({ shiftId: shift._id }).exec();
    const cashSales = payments.reduce((sum, p) => {
      if (p.method === PaymentMethod.CASH) return sum + p.amountTiyns;
      if (p.method === PaymentMethod.SPLIT) {
        return (
          sum +
          p.splits
            .filter((s) => s.method === PaymentMethod.CASH)
            .reduce((a, s) => a + s.amountTiyns, 0)
        );
      }
      return sum;
    }, 0);

    const ops = await this.cashModel.find({ shiftId: shift._id }).exec();
    const cashIn = ops
      .filter((o) => o.type === CashOpType.CASH_IN)
      .reduce((s, o) => s + o.amountTiyns, 0);
    const cashOut = ops
      .filter((o) => o.type === CashOpType.CASH_OUT)
      .reduce((s, o) => s + o.amountTiyns, 0);

    const expected =
      Math.trunc(shift.openingCashTiyns) + cashSales + cashIn - cashOut;
    const actual = Math.trunc(dto.actualCashTiyns);

    shift.status = ShiftStatus.CLOSED;
    shift.closedBy = toObjectId(user.userId);
    shift.closedAt = new Date();
    shift.expectedCashTiyns = expected;
    shift.actualCashTiyns = actual;
    shift.discrepancyTiyns = expected - actual;
    shift.closeNote = dto.closeNote;
    await shift.save();

    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: shift.restaurantId,
      userId: user.userId,
      action: 'SHIFT_CLOSE',
      entityType: 'Shift',
      entityId: id,
      meta: {
        expectedCashTiyns: expected,
        actualCashTiyns: actual,
        discrepancyTiyns: shift.discrepancyTiyns,
      },
    });
    return shift;
  }

  async cashOp(user: JwtPayload, shiftId: string, dto: CashOperationDto) {
    const shift = await this.shiftModel
      .findOne({
        _id: toObjectId(shiftId),
        organizationId: toObjectId(user.organizationId),
        status: ShiftStatus.OPEN,
      })
      .exec();
    if (!shift) throw new NotFoundException('Open shift not found');

    const op = await this.cashModel.create({
      shiftId: shift._id,
      organizationId: shift.organizationId,
      restaurantId: shift.restaurantId,
      type: dto.type,
      amountTiyns: Math.trunc(dto.amountTiyns),
      reason: dto.reason,
      createdBy: toObjectId(user.userId),
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: shift.restaurantId,
      userId: user.userId,
      action: 'SHIFT_CASH_OP',
      entityType: 'CashOperation',
      entityId: String(op._id),
      meta: { type: dto.type, amountTiyns: dto.amountTiyns },
    });
    return op;
  }
}
