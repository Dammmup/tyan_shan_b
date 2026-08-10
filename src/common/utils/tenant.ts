import { Types } from 'mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export function toObjectId(id: string, label = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return new Types.ObjectId(id);
}

export function resolveRestaurantId(
  user: JwtPayload,
  queryRestaurantId?: string,
): string {
  if (user.restaurantId) {
    if (queryRestaurantId && queryRestaurantId !== user.restaurantId) {
      if (user.role !== 'OWNER' && !user.permissions.includes('RESTAURANT_MANAGE')) {
        throw new ForbiddenException('Cannot access another restaurant');
      }
      return queryRestaurantId;
    }
    return user.restaurantId;
  }

  if (queryRestaurantId) {
    if (user.role !== 'OWNER' && !user.permissions.includes('RESTAURANT_MANAGE')) {
      throw new ForbiddenException('restaurantId required from JWT');
    }
    return queryRestaurantId;
  }

  throw new BadRequestException('restaurantId is required');
}

export function tenantFilter(
  user: JwtPayload,
  restaurantId?: string,
): { organizationId: Types.ObjectId; restaurantId: Types.ObjectId } {
  const rid = resolveRestaurantId(user, restaurantId);
  return {
    organizationId: toObjectId(user.organizationId, 'organizationId'),
    restaurantId: toObjectId(rid, 'restaurantId'),
  };
}
