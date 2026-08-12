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
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { MenuService } from './menu.service';
import {
  CreateCategoryDto,
  CreateModifierDto,
  CreateModifierGroupDto,
  CreatePriceDto,
  CreateProductDto,
  StopListDto,
  UpdateCategoryDto,
  UpdateModifierDto,
  UpdateModifierGroupDto,
  UpdateProductDto,
} from './menu.dto';

@ApiTags('menu')
@ApiBearerAuth()
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post('categories')
  @Permissions(Permission.MENU_MANAGE)
  createCategory(@CurrentUser() user: JwtPayload, @Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(user, dto);
  }

  @Get('categories')
  listCategories(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.menuService.listCategories(user, restaurantId);
  }

  @Patch('categories/:id')
  @Permissions(Permission.MENU_MANAGE)
  updateCategory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(user, id, dto);
  }

  @Delete('categories/:id')
  @Permissions(Permission.MENU_MANAGE)
  removeCategory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.menuService.softDeleteCategory(user, id);
  }

  @Post('products')
  @Permissions(Permission.MENU_MANAGE)
  createProduct(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.menuService.createProduct(user, dto);
  }

  @Get('products')
  listProducts(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.menuService.listProducts(user, restaurantId, categoryId);
  }

  @Patch('products/:id')
  @Permissions(Permission.MENU_MANAGE)
  updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.menuService.updateProduct(user, id, dto);
  }

  @Delete('products/:id')
  @Permissions(Permission.MENU_MANAGE)
  removeProduct(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.menuService.softDeleteProduct(user, id);
  }

  @Patch('products/:id/stop-list')
  @Permissions(Permission.MENU_STOPLIST)
  stopList(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StopListDto,
  ) {
    return this.menuService.setStopList(user, id, dto);
  }

  @Post('prices')
  @Permissions(Permission.MENU_MANAGE)
  createPrice(@CurrentUser() user: JwtPayload, @Body() dto: CreatePriceDto) {
    return this.menuService.createPrice(user, dto);
  }

  @Get('prices')
  listPrices(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.menuService.listPrices(user, restaurantId, productId);
  }

  @Post('modifier-groups')
  @Permissions(Permission.MENU_MANAGE)
  createGroup(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateModifierGroupDto,
  ) {
    return this.menuService.createModifierGroup(user, dto);
  }

  @Get('modifier-groups')
  listGroups(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.menuService.listModifierGroups(user, restaurantId);
  }

  @Patch('modifier-groups/:id')
  @Permissions(Permission.MENU_MANAGE)
  updateGroup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateModifierGroupDto,
  ) {
    return this.menuService.updateModifierGroup(user, id, dto);
  }

  @Delete('modifier-groups/:id')
  @Permissions(Permission.MENU_MANAGE)
  removeGroup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.menuService.softDeleteModifierGroup(user, id);
  }

  @Post('modifiers')
  @Permissions(Permission.MENU_MANAGE)
  createModifier(@CurrentUser() user: JwtPayload, @Body() dto: CreateModifierDto) {
    return this.menuService.createModifier(user, dto);
  }

  @Get('modifiers')
  listModifiers(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.menuService.listModifiers(user, restaurantId, groupId);
  }

  @Patch('modifiers/:id')
  @Permissions(Permission.MENU_MANAGE)
  updateModifier(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateModifierDto,
  ) {
    return this.menuService.updateModifier(user, id, dto);
  }

  @Delete('modifiers/:id')
  @Permissions(Permission.MENU_MANAGE)
  removeModifier(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.menuService.softDeleteModifier(user, id);
  }
}
