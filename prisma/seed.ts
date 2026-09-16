import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import type { PermissionFlags } from "@/constants/permissions";

const NAV_MENUS = [
  { menuKey: "dashboard", name: "Dashboard", url: "/", icon: "LayoutDashboard" },
  { menuKey: "quotes", name: "RFQ List", url: "/quotes", icon: "FileText" },
  { menuKey: "customers", name: "Customers", url: "/customers", icon: "Users" },
  { menuKey: "roles", name: "Roles", url: "/roles", icon: "ShieldCheck" },
  { menuKey: "left-menu", name: "Left Menu", url: "/left-menu", icon: "ListTree" },
  { menuKey: "permissions", name: "Permissions", url: "/permissions", icon: "KeyRound" },
  { menuKey: "users", name: "Users", url: "/users", icon: "UserCog" },
] as const;

const FULL_ACCESS: PermissionFlags = {
  List: true,
  Add: true,
  Edit: true,
  View: true,
  Delete: true,
  StatusChange: true,
  Approve: true,
};

const READ_ONLY: PermissionFlags = {
  List: true,
  Add: false,
  Edit: false,
  View: true,
  Delete: false,
  StatusChange: false,
  Approve: false,
};

// Default menu access for non-admin roles. UserRole.admin bypasses this
// entirely and always sees every active menu (see MyMenu in
// left-menu.controller.ts) — System Administration items (roles, left-menu,
// permissions, users) are intentionally left out of every non-admin grant.
const DEFAULT_ROLE_GRANTS: Record<string, Record<string, PermissionFlags>> = {
  [UserRole.manager]: {
    dashboard: READ_ONLY,
    quotes: FULL_ACCESS,
    customers: FULL_ACCESS,
  },
  [UserRole.sales]: {
    dashboard: READ_ONLY,
    quotes: FULL_ACCESS,
    customers: READ_ONLY,
  },
  [UserRole.viewer]: {
    dashboard: READ_ONLY,
    quotes: READ_ONLY,
    customers: READ_ONLY,
  },
};

async function seedAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "[seed] BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD not set — skipping admin seed.",
    );
    return null;
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.admin },
  });

  if (existingAdmin) {
    console.log(`[seed] Admin already exists (${existingAdmin.email}) — skipping.`);
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: "Admin",
      role: UserRole.admin,
      active: true,
    },
  });

  console.log(`[seed] Bootstrap admin created: ${admin.email}`);
  return admin;
}

async function seedNavMenus(adminId: string) {
  for (const menu of NAV_MENUS) {
    await prisma.leftMenu.upsert({
      where: { menuKey: menu.menuKey },
      update: { name: menu.name, url: menu.url, icon: menu.icon, active: true, trashed: false },
      create: { ...menu, createdBy: adminId },
    });
  }
  console.log(`[seed] Ensured ${NAV_MENUS.length} left menu entries.`);
}

async function seedRoleGrants(adminId: string) {
  for (const [roleName, grants] of Object.entries(DEFAULT_ROLE_GRANTS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, dataScope: "CREATED", createdBy: adminId },
    });

    for (const [menuKey, permissions] of Object.entries(grants)) {
      await prisma.rolePermission.upsert({
        where: { roleId_menuKey: { roleId: role.id, menuKey } },
        update: {},
        create: { roleId: role.id, menuKey, permissions, createdBy: adminId },
      });
    }
  }
  console.log(`[seed] Ensured default role grants for: ${Object.keys(DEFAULT_ROLE_GRANTS).join(", ")}.`);
}

async function main() {
  const admin = await seedAdmin();
  if (!admin) return;

  await seedNavMenus(admin.id);
  await seedRoleGrants(admin.id);
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
