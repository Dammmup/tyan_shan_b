/**
 * Patch productionCenter on existing products from curated menu (no wipe).
 * Usage: npx ts-node -r tsconfig-paths/register src/update-centers.ts
 */
import mongoose from 'mongoose';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { preferPublicDns } from './common/utils/mongo-dns';
import { CURATED_MENU } from './menu-curated';
import { OrganizationSchema } from './modules/organizations/organization.schema';
import { RestaurantSchema } from './modules/restaurants/restaurant.schema';
import { ProductSchema } from './modules/menu/menu.schemas';

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

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  const Organization = mongoose.model('Organization', OrganizationSchema);
  const Restaurant = mongoose.model('Restaurant', RestaurantSchema);
  const Product = mongoose.model('Product', ProductSchema);
  const org = await Organization.findOne({ name: 'Tyan Shan Demo' }).exec();
  if (!org) throw new Error('org missing');
  const restaurant = await Restaurant.findOne({ organizationId: org._id }).exec();
  if (!restaurant) throw new Error('restaurant missing');

  let updated = 0;
  for (const block of CURATED_MENU.categories) {
    for (const item of block.items) {
      const res = await Product.updateMany(
        { restaurantId: restaurant._id, name: item.name, isActive: true },
        { $set: { productionCenter: item.productionCenter } },
      );
      updated += res.modifiedCount;
    }
  }

  // Ensure cold printer exists
  const PrinterSchema = new mongoose.Schema(
    {
      name: String,
      organizationId: mongoose.Schema.Types.ObjectId,
      restaurantId: mongoose.Schema.Types.ObjectId,
      productionCenter: String,
      ip: String,
      port: Number,
      isActive: Boolean,
    },
    { collection: 'printers' },
  );
  const Printer = mongoose.models.Printer || mongoose.model('Printer', PrinterSchema);
  const cold = await Printer.findOne({
    restaurantId: restaurant._id,
    productionCenter: 'COLD',
  }).exec();
  if (!cold) {
    await Printer.create({
      name: 'Холодный цех',
      organizationId: org._id,
      restaurantId: restaurant._id,
      productionCenter: 'COLD',
      ip: '192.168.1.49',
      port: 9100,
      isActive: true,
    });
    console.log('Created COLD printer');
  }
  const other = await Printer.findOne({
    restaurantId: restaurant._id,
    productionCenter: 'OTHER',
  }).exec();
  if (!other) {
    await Printer.create({
      name: 'Предчек',
      organizationId: org._id,
      restaurantId: restaurant._id,
      productionCenter: 'OTHER',
      ip: '192.168.1.54',
      port: 9100,
      isActive: true,
    });
    console.log('Created OTHER printer');
  }

  console.log(`Updated productionCenter on ${updated} products`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
