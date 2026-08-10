import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { ShiftsService } from './shifts.service';
import { CashOperationDto, CloseShiftDto, OpenShiftDto } from './shifts.dto';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @Permissions(Permission.SHIFT_OPEN)
  open(@CurrentUser() user: JwtPayload, @Body() dto: OpenShiftDto) {
    return this.shiftsService.open(user, dto);
  }

  @Get('current')
  current(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.shiftsService.current(user, restaurantId);
  }

  @Post(':id/close')
  @Permissions(Permission.SHIFT_CLOSE)
  close(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.close(user, id, dto);
  }

  @Post(':id/cash')
  @Permissions(Permission.SHIFT_CASH)
  cash(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CashOperationDto,
  ) {
    return this.shiftsService.cashOp(user, id, dto);
  }
}
