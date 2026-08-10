import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { Restaurant, RestaurantDocument } from './restaurant.schema';
import { CreateRestaurantDto, UpdateRestaurantDto } from './restaurants.dto';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly audit: AuditService,
  ) {}

  async create(user: JwtPayload, dto: CreateRestaurantDto) {
    const doc = await this.restaurantModel.create({
      name: dto.name,
      address: dto.address,
      timezone: dto.timezone ?? 'Asia/Almaty',
      organizationId: toObjectId(user.organizationId),
      isActive: true,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: doc._id,
      userId: user.userId,
      action: 'RESTAURANT_CREATE',
      entityType: 'Restaurant',
      entityId: String(doc._id),
    });
    return doc;
  }

  list(user: JwtPayload) {
    return this.restaurantModel
      .find({ organizationId: toObjectId(user.organizationId), isActive: true })
      .sort({ name: 1 })
      .exec();
  }

  async get(user: JwtPayload, id: string) {
    const doc = await this.restaurantModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Restaurant not found');
    return doc;
  }

  async update(user: JwtPayload, id: string, dto: UpdateRestaurantDto) {
    const doc = await this.get(user, id);
    if (dto.name) doc.name = dto.name;
    if (dto.address !== undefined) doc.address = dto.address;
    if (dto.timezone) doc.timezone = dto.timezone;
    await doc.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: doc._id,
      userId: user.userId,
      action: 'RESTAURANT_UPDATE',
      entityType: 'Restaurant',
      entityId: id,
    });
    return doc;
  }
}
