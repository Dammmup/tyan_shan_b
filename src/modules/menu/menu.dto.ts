import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAvailability, ProductionCenter } from '../../common/enums';

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsMongoId()
  categoryId!: string;

  @ApiProperty({ description: 'Base price in tiyns' })
  @IsInt()
  @Min(0)
  basePriceTiyns!: number;

  @ApiProperty({ enum: ProductionCenter })
  @IsEnum(ProductionCenter)
  productionCenter!: ProductionCenter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  modifierGroupIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  basePriceTiyns?: number;

  @ApiPropertyOptional({ enum: ProductionCenter })
  @IsOptional()
  @IsEnum(ProductionCenter)
  productionCenter?: ProductionCenter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePriceDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ description: 'Price in tiyns' })
  @IsInt()
  @Min(0)
  priceTiyns!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  hallId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class CreateModifierGroupDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  minSelect?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxSelect?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class CreateModifierDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsMongoId()
  groupId!: string;

  @ApiProperty({ description: 'Extra price in tiyns' })
  @IsInt()
  @Min(0)
  priceTiyns!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class StopListDto {
  @ApiProperty({ enum: ProductAvailability })
  @IsEnum(ProductAvailability)
  availability!: ProductAvailability;
}
