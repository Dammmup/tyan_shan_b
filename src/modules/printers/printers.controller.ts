import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission, PrintJobStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrintersService } from './printers.service';
import { CreatePrinterDto, UpdatePrinterDto } from './printers.dto';

@ApiTags('printers')
@ApiBearerAuth()
@Controller('printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Post()
  @Permissions(Permission.PRINTER_MANAGE)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePrinterDto) {
    return this.printersService.create(user, dto);
  }

  @Get()
  @Permissions(Permission.PRINTER_MANAGE)
  list(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.printersService.list(user, restaurantId);
  }

  @Get('print-jobs')
  @Permissions(Permission.PRINT_JOB_MANAGE)
  listJobs(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
    @Query('status') status?: PrintJobStatus,
  ) {
    return this.printersService.listJobs(user, restaurantId, status);
  }

  @Post('print-jobs/:id/retry')
  @Permissions(Permission.PRINT_JOB_MANAGE)
  retry(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.printersService.retry(user, id);
  }

  @Post('print-jobs/:id/ack')
  @Permissions(Permission.PRINT_JOB_MANAGE)
  ack(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.printersService.ack(user, id);
  }

  @Patch(':id')
  @Permissions(Permission.PRINTER_MANAGE)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePrinterDto,
  ) {
    return this.printersService.update(user, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.PRINTER_MANAGE)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.printersService.remove(user, id);
  }
}
