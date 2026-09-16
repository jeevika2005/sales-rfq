-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('CREATED', 'ASSIGNED', 'ALL');

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "dataScope" "DataScope" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trashed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trashed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "menuKey" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trashed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeftMenu" (
    "id" UUID NOT NULL,
    "menuKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "url" TEXT,
    "isParent" BOOLEAN NOT NULL DEFAULT false,
    "parentId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trashed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeftMenu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_menuKey_key" ON "RolePermission"("roleId", "menuKey");

-- CreateIndex
CREATE UNIQUE INDEX "LeftMenu_menuKey_key" ON "LeftMenu"("menuKey");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeftMenu" ADD CONSTRAINT "LeftMenu_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LeftMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
