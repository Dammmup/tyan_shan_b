import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  Permission,
  ProductionCenter,
  TableStatus,
  UserStatus,
} from './common/enums';
import { ROLE_PERMISSIONS } from './common/role-permissions';
import { preferPublicDns } from './common/utils/mongo-dns';
import { OrganizationSchema } from './modules/organizations/organization.schema';
import { RestaurantSchema } from './modules/restaurants/restaurant.schema';
import { RoleSchema } from './modules/roles/role.schema';
import { UserSchema } from './modules/users/user.schema';
import { HallSchema, TableSchema } from './modules/halls/hall-table.schema';
import {
  CategorySchema,
  ProductSchema,
} from './modules/menu/menu.schemas';
import {
  PrinterSchema,
  PrinterAgentTokenSchema,
} from './modules/printers/printer.schemas';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();
preferPublicDns();

const ROLE_PERMS: Record<string, Permission[]> = ROLE_PERMISSIONS;

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  const Organization = mongoose.model('Organization', OrganizationSchema);
  const Restaurant = mongoose.model('Restaurant', RestaurantSchema);
  const Role = mongoose.model('Role', RoleSchema);
  const User = mongoose.model('User', UserSchema);
  const Hall = mongoose.model('Hall', HallSchema);
  const Table = mongoose.model('Table', TableSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const Product = mongoose.model('Product', ProductSchema);
  const Printer = mongoose.model('Printer', PrinterSchema);
  const AgentToken = mongoose.model('PrinterAgentToken', PrinterAgentTokenSchema);

  await Promise.all([
    Organization.deleteMany({}),
    Restaurant.deleteMany({}),
    Role.deleteMany({}),
    User.deleteMany({}),
    Hall.deleteMany({}),
    Table.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Printer.deleteMany({}),
    AgentToken.deleteMany({}),
  ]);

  const org = await Organization.create({ name: 'Tyan Shan Demo', isActive: true });
  const restaurant = await Restaurant.create({
    name: 'Главный',
    organizationId: org._id,
    isActive: true,
    timezone: 'Asia/Almaty',
  });

  const roleDocs: Record<string, mongoose.Document> = {};
  for (const [name, permissions] of Object.entries(ROLE_PERMS)) {
    roleDocs[name] = await Role.create({
      name,
      permissions,
      organizationId: org._id,
      isSystem: true,
    });
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  await User.create({
    email: 'owner@demo.kz',
    name: 'Owner Demo',
    passwordHash,
    roleId: roleDocs.OWNER._id,
    organizationId: org._id,
    restaurantId: restaurant._id,
    status: UserStatus.ACTIVE,
    refreshTokens: [],
  });

  await User.create({
    email: 'waiter@demo.kz',
    name: 'Waiter Demo',
    passwordHash,
    pinHash: await bcrypt.hash('1111', 10),
    roleId: roleDocs.WAITER._id,
    organizationId: org._id,
    restaurantId: restaurant._id,
    status: UserStatus.ACTIVE,
    refreshTokens: [],
  });

  await User.create({
    email: 'senior@demo.kz',
    name: 'Senior Waiter',
    passwordHash,
    pinHash: await bcrypt.hash('4444', 10),
    roleId: roleDocs.SENIOR_WAITER._id,
    organizationId: org._id,
    restaurantId: restaurant._id,
    status: UserStatus.ACTIVE,
    refreshTokens: [],
  });

  await User.create({
    email: 'cashier@demo.kz',
    name: 'Cashier Demo',
    passwordHash,
    pinHash: await bcrypt.hash('2222', 10),
    roleId: roleDocs.CASHIER._id,
    organizationId: org._id,
    restaurantId: restaurant._id,
    status: UserStatus.ACTIVE,
    refreshTokens: [],
  });

  await User.create({
    email: 'kitchen@demo.kz',
    name: 'Kitchen Demo',
    passwordHash,
    pinHash: await bcrypt.hash('3333', 10),
    roleId: roleDocs.KITCHEN._id,
    organizationId: org._id,
    restaurantId: restaurant._id,
    status: UserStatus.ACTIVE,
    refreshTokens: [],
  });

  const hall = await Hall.create({
    name: 'Основной зал',
    organizationId: org._id,
    restaurantId: restaurant._id,
    isActive: true,
    sortOrder: 1,
  });

  const tables = [];
  for (let i = 1; i <= 9; i++) {
    const col = (i - 1) % 3;
    const row = Math.floor((i - 1) / 3);
    tables.push({
      name: `T${i}`,
      hallId: hall._id,
      organizationId: org._id,
      restaurantId: restaurant._id,
      positionX: 40 + col * 120,
      positionY: 40 + row * 120,
      width: 80,
      height: 80,
      status: TableStatus.FREE,
      seats: 4,
      isActive: true,
    });
  }
  await Table.insertMany(tables);

  const cats = {
    hot: await Category.create({
      name: 'Горячее',
      organizationId: org._id,
      restaurantId: restaurant._id,
      sortOrder: 1,
      isActive: true,
    }),
    drinks: await Category.create({
      name: 'Напитки',
      organizationId: org._id,
      restaurantId: restaurant._id,
      sortOrder: 2,
      isActive: true,
    }),
    dessert: await Category.create({
      name: 'Десерты',
      organizationId: org._id,
      restaurantId: restaurant._id,
      sortOrder: 3,
      isActive: true,
    }),
  };

  // Prices in tiyns (1 tenge = 100 tiyns)
  await Product.insertMany([
    {
      name: 'Лагман',
      categoryId: cats.hot._id,
      organizationId: org._id,
      restaurantId: restaurant._id,
      basePriceTiyns: 2500 * 100,
      productionCenter: ProductionCenter.KITCHEN,
      isActive: true,
    },
    {
      name: 'Стейк',
      categoryId: cats.hot._id,
      organizationId: org._id,
      restaurantId: restaurant._id,
      basePriceTiyns: 8000 * 100,
      productionCenter: ProductionCenter.GRILL,
      isActive: true,
    },
    {
      name: 'Кола',
      categoryId: cats.drinks._id,
      organizationId: org._id,
      restaurantId: restaurant._id,
      basePriceTiyns: 700 * 100,
      productionCenter: ProductionCenter.BAR,
      isActive: true,
    },
    {
      name: 'Кофе',
      categoryId: cats.drinks._id,
      organizationId: org._id,
      restaurantId: restaurant._id,
      basePriceTiyns: 900 * 100,
      productionCenter: ProductionCenter.BAR,
      isActive: true,
    },
    {
      name: 'Чизкейк',
      categoryId: cats.dessert._id,
      organizationId: org._id,
      restaurantId: restaurant._id,
      basePriceTiyns: 3000 * 100,
      productionCenter: ProductionCenter.DESSERT,
      isActive: true,
    },
  ]);

  await Printer.create({
    name: 'Холодный цех',
    organizationId: org._id,
    restaurantId: restaurant._id,
    productionCenter: ProductionCenter.COLD,
    ip: '192.168.1.49',
    port: 9100,
    isActive: true,
  });
  await Printer.create({
    name: 'Китайский / горячий цех',
    organizationId: org._id,
    restaurantId: restaurant._id,
    productionCenter: ProductionCenter.KITCHEN,
    ip: '192.168.1.50',
    port: 9100,
    isActive: true,
  });
  await Printer.create({
    name: 'Бар',
    organizationId: org._id,
    restaurantId: restaurant._id,
    productionCenter: ProductionCenter.BAR,
    ip: '192.168.1.51',
    port: 9100,
    isActive: true,
  });
  await Printer.create({
    name: 'Мангал',
    organizationId: org._id,
    restaurantId: restaurant._id,
    productionCenter: ProductionCenter.GRILL,
    ip: '192.168.1.52',
    port: 9100,
    isActive: true,
  });
  await Printer.create({
    name: 'Десерты',
    organizationId: org._id,
    restaurantId: restaurant._id,
    productionCenter: ProductionCenter.DESSERT,
    ip: '192.168.1.53',
    port: 9100,
    isActive: true,
  });
  await Printer.create({
    name: 'Предчек',
    organizationId: org._id,
    restaurantId: restaurant._id,
    productionCenter: ProductionCenter.OTHER,
    ip: '192.168.1.54',
    port: 9100,
    isActive: true,
  });
  const agentToken = randomBytes(32).toString('hex');
  await AgentToken.create({
    organizationId: org._id,
    restaurantId: restaurant._id,
    token: agentToken,
    deviceName: 'demo-printer-agent',
    isActive: true,
  });

  console.log('Seed completed');
  console.log('Organization:', org.name, String(org._id));
  console.log('Restaurant:', restaurant.name, String(restaurant._id));
  console.log('Owner login: owner@demo.kz / password123');
  console.log('Waiter PIN: 1111 | Cashier PIN: 2222 | Kitchen PIN: 3333');
  console.log('Printer agent token:', agentToken);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
