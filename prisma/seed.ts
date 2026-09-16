import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";


async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "[seed] BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD not set — skipping admin seed.",
    );
    return;
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.admin },
  });

  if (existingAdmin) {
    console.log(
      `[seed] Admin already exists (${existingAdmin.email}) — skipping.`,
    );
    return;
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
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
