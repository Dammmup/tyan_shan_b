/**
 * Upsert system roles/permissions without wiping data.
 * Usage: npm run sync:roles
 */
import mongoose from 'mongoose';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { preferPublicDns } from './common/utils/mongo-dns';
import { ROLE_PERMISSIONS } from './common/role-permissions';
import { OrganizationSchema } from './modules/organizations/organization.schema';
import { RoleSchema } from './modules/roles/role.schema';

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
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);
  const Organization = mongoose.model('Organization', OrganizationSchema);
  const Role = mongoose.model('Role', RoleSchema);

  const orgs = await Organization.find({ isActive: true }).exec();
  if (!orgs.length) {
    console.log('No organizations found');
    await mongoose.disconnect();
    return;
  }

  for (const org of orgs) {
    for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const existing = await Role.findOne({
        organizationId: org._id,
        name,
      }).exec();
      if (existing) {
        existing.permissions = permissions;
        existing.isSystem = true;
        await existing.save();
        console.log(`Updated role ${name} @ ${org.name}`);
      } else {
        await Role.create({
          name,
          permissions,
          organizationId: org._id,
          isSystem: true,
        });
        console.log(`Created role ${name} @ ${org.name}`);
      }
    }
  }

  await mongoose.disconnect();
  console.log('sync:roles done');
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
