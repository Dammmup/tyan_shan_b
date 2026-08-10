import {
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty()
  @IsMongoId()
  roleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class SetPinDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  pin!: string;
}
