import {
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/enums';

export class PaymentSplitDto {
  @ApiProperty({ enum: [PaymentMethod.CASH, PaymentMethod.CARD] })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ description: 'Amount in tiyns' })
  @IsInt()
  @Min(0)
  amountTiyns!: number;
}

export class CreatePaymentDto {
  @ApiProperty()
  @IsMongoId()
  orderId!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ description: 'Total paid in tiyns' })
  @IsInt()
  @Min(0)
  amountTiyns!: number;

  @ApiPropertyOptional({ type: [PaymentSplitDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  splits?: PaymentSplitDto[];
}
