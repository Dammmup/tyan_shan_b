/**
 * Import curated menu into the demo restaurant.
 * Usage: WIPE_MENU=1 npm run import:menu
 *
 * Replaces broken PDF-parsed names with grammar- and sense-corrected dishes.
 */
import mongoose from 'mongoose';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { ProductionCenter } from './common/enums';
import { preferPublicDns } from './common/utils/mongo-dns';
import { CURATED_MENU } from './menu-curated';
import { OrganizationSchema } from './modules/organizations/organization.schema';
import { RestaurantSchema } from './modules/restaurants/restaurant.schema';
import { CategorySchema, ProductSchema } from './modules/menu/menu.schemas';

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

const CENTER_MAP: Record<string, ProductionCenter> = {
  COLD: ProductionCenter.COLD,
  KITCHEN: ProductionCenter.KITCHEN,
  BAR: ProductionCenter.BAR,
  GRILL: ProductionCenter.GRILL,
  DESSERT: ProductionCenter.DESSERT,
  OTHER: ProductionCenter.OTHER,
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const payload = CURATED_MENU;
  writeFileSync(
    resolve(process.cwd(), 'menu_from_pdf.json'),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
  console.log(`Curated menu: ${payload.total} dishes / ${payload.categories.length} categories`);

  await mongoose.connect(uri);
  const Organization = mongoose.model('Organization', OrganizationSchema);
  const Restaurant = mongoose.model('Restaurant', RestaurantSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const Product = mongoose.model('Product', ProductSchema);

  const org = await Organization.findOne({ name: 'Tyan Shan Demo' }).exec();
  if (!org) throw new Error('Organization "Tyan Shan Demo" not found. Run npm run seed first.');
  const restaurant = await Restaurant.findOne({ organizationId: org._id }).exec();
  if (!restaurant) throw new Error('Restaurant not found');

  // Always replace menu for curated import so broken PDF names disappear
  const wipe = process.env.WIPE_MENU !== '0';
  if (wipe) {
    const delProducts = await Product.deleteMany({ restaurantId: restaurant._id });
    const delCats = await Category.deleteMany({ restaurantId: restaurant._id });
    console.log(
      `Removed old menu: products=${delProducts.deletedCount}, categories=${delCats.deletedCount}`,
    );
  }

  let createdCats = 0;
  let createdProducts = 0;

  for (let i = 0; i < payload.categories.length; i++) {
    const block = payload.categories[i]!;
    const cat = await Category.create({
      name: block.category,
      organizationId: org._id,
      restaurantId: restaurant._id,
      sortOrder: i + 1,
      isActive: true,
    });
    createdCats += 1;

    const center =
      CENTER_MAP[block.center] ||
      CENTER_MAP[block.items[0]?.productionCenter || ''] ||
      ProductionCenter.KITCHEN;

    for (const item of block.items) {
      const priceTiyns = Math.trunc(item.priceTenge) * 100;
      await Product.create({
        name: item.name,
        description: item.description,
        categoryId: cat._id,
        organizationId: org._id,
        restaurantId: restaurant._id,
        basePriceTiyns: priceTiyns,
        productionCenter: CENTER_MAP[item.productionCenter] || center,
        isActive: true,
      });
      createdProducts += 1;
    }
  }

  console.log('Import done');
  console.log(`Restaurant: ${restaurant.name} ${String(restaurant._id)}`);
  console.log(`Categories: ${createdCats}, products: ${createdProducts}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
