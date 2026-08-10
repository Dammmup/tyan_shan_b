import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard/today')
  @Permissions(Permission.REPORT_VIEW)
  dashboard(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.reportsService.dashboardToday(user, restaurantId);
  }

  @Get('by-waiters')
  @Permissions(Permission.REPORT_VIEW)
  byWaiters(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.reportsService.byWaiters(user, restaurantId);
  }

  @Get('by-products')
  @Permissions(Permission.REPORT_VIEW)
  byProducts(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.reportsService.byProducts(user, restaurantId);
  }

  @Get('by-payment-methods')
  @Permissions(Permission.REPORT_VIEW)
  byPaymentMethods(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.reportsService.byPaymentMethods(user, restaurantId);
  }

  @Get('shifts/:id')
  @Permissions(Permission.REPORT_VIEW)
  shiftReport(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reportsService.shiftReport(user, id);
  }
}
