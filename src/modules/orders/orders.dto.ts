import {
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemInputDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  modifierIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsMongoId()
  tableId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [OrderItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items?: OrderItemInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class AddOrderItemDto extends OrderItemInputDto {}

export class CreateSubOrderDto {
  @ApiPropertyOptional({ description: 'Specific NEW item ids; default all NEW' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  itemIds?: string[];
}
