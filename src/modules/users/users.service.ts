import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { User, UserDocument } from './user.schema';
import { CreateUserDto, SetPinDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly audit: AuditService,
  ) {}

  async create(user: JwtPayload, dto: CreateUserDto) {
    const exists = await this.userModel
      .findOne({
        organizationId: user.organizationId,
        email: dto.email.toLowerCase(),
      })
      .exec();
    if (exists) {
      throw new BadRequestException('Email already used');
    }
    const restaurantId = dto.restaurantId
      ? toObjectId(dto.restaurantId)
      : user.restaurantId
        ? toObjectId(user.restaurantId)
        : null;

    const doc = await this.userModel.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      passwordHash: await bcrypt.hash(dto.password, 10),
      roleId: toObjectId(dto.roleId),
      organizationId: toObjectId(user.organizationId),
      restaurantId,
      status: UserStatus.ACTIVE,
      refreshTokens: [],
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: restaurantId,
      userId: user.userId,
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: String(doc._id),
    });
    return this.sanitize(doc);
  }

  async list(user: JwtPayload, restaurantId?: string) {
    const filter: Record<string, unknown> = {
      organizationId: toObjectId(user.organizationId),
      status: { $ne: UserStatus.ARCHIVED },
    };
    if (restaurantId || user.restaurantId) {
      filter.restaurantId = toObjectId(
        restaurantId || (user.restaurantId as string),
      );
    }
    const rows = await this.userModel.find(filter).sort({ name: 1 }).exec();
    return rows.map((u) => this.sanitize(u));
  }

  async get(user: JwtPayload, id: string) {
    const doc = await this.userModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('User not found');
    return this.sanitize(doc);
  }

  async update(user: JwtPayload, id: string, dto: UpdateUserDto) {
    const doc = await this.userModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('User not found');
    if (dto.name) doc.name = dto.name;
    if (dto.roleId) doc.roleId = toObjectId(dto.roleId);
    if (dto.restaurantId !== undefined) {
      doc.restaurantId = dto.restaurantId ? toObjectId(dto.restaurantId) : null;
    }
    await doc.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: doc.restaurantId,
      userId: user.userId,
      action: 'USER_UPDATE',
      entityType: 'User',
      entityId: id,
    });
    return this.sanitize(doc);
  }

  async archive(user: JwtPayload, id: string) {
    const doc = await this.userModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('User not found');
    doc.status = UserStatus.ARCHIVED;
    doc.refreshTokens = [];
    await doc.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: doc.restaurantId,
      userId: user.userId,
      action: 'USER_ARCHIVE',
      entityType: 'User',
      entityId: id,
    });
    return this.sanitize(doc);
  }

  async setPin(user: JwtPayload, id: string, dto: SetPinDto) {
    const doc = await this.userModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('User not found');
    doc.pinHash = await bcrypt.hash(dto.pin, 10);
    await doc.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: doc.restaurantId,
      userId: user.userId,
      action: 'USER_SET_PIN',
      entityType: 'User',
      entityId: id,
    });
    return { ok: true };
  }

  private sanitize(doc: UserDocument) {
    return {
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      roleId: String(doc.roleId),
      organizationId: String(doc.organizationId),
      restaurantId: doc.restaurantId ? String(doc.restaurantId) : null,
      status: doc.status,
      hasPin: Boolean(doc.pinHash),
      createdAt: (doc as unknown as { createdAt?: Date }).createdAt,
    };
  }
}
