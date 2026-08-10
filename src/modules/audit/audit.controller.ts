import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { resolveRestaurantId } from '../../common/utils/tenant';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(Permission.AUDIT_VIEW)
  list(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const rid = resolveRestaurantId(user, restaurantId);
    return this.auditService.list({
      organizationId: user.organizationId,
      restaurantId: rid,
      limit: limit ? Number(limit) : 50,
      skip: skip ? Number(skip) : 0,
    });
  }
}
