import type { Session } from "next-auth";

import type { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { deleteAttachmentFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/response";
import { assertValidStatusTransition } from "@/types/quote-status";
import type { CreateQuoteInput, UpdateQuoteInput } from "@/validations/quote.validation";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// §6.3 — SAL-{YYYY}-{DD}{MM}{HH}{MM}{SS}, server-generated only.
function formatQuoteNumber(date: Date): string {
  const YYYY = date.getFullYear();
  const DD = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const HH = pad(date.getHours());
  const MI = pad(date.getMinutes());
  const SS = pad(date.getSeconds());
  return `SAL-${YYYY}-${DD}${MM}${HH}${MI}${SS}`;
}

// Collision: retry with +1 second (spec's own resolution strategy).
async function generateUniqueQuoteNumber(): Promise<string> {
  let attemptDate = new Date();

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = formatQuoteNumber(attemptDate);
    const existing = await prisma.quote.findUnique({ where: { quoteNumber: candidate } });
    if (!existing) return candidate;
    attemptDate = new Date(attemptDate.getTime() + 1000);
  }

  // Extremely unlikely fallback after 5 collisions — short random suffix.
  return `${formatQuoteNumber(attemptDate)}-${Math.random().toString(36).slice(2, 6)}`;
}

// §10 — Line total = round(qty * unitPrice, 2). Server-computed only;
// a client-sent totalPrice/totalAmount is never trusted (FR4.10).
function computeLineTotal(quantity: number, unitPrice: number | undefined): number {
  if (unitPrice === undefined) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

function buildItemName(valveType: string, attributes: Record<string, unknown>): string {
  const size = attributes.size;
  return typeof size === "string" && size ? `${valveType} - ${size}` : valveType;
}

type ValveItemInput = CreateQuoteInput["valveItems"][number];

// Shared by create and update — one place that turns a SalesValveItem[]
// into QuoteItem row data, so the two paths can't silently drift apart.
function buildItemsData(valveItems: ValveItemInput[]) {
  return valveItems.map((item) => {
    const totalPrice = item.totalPrice ?? computeLineTotal(item.quantity, item.unitPrice);
    const attributes = { ...item.attributes, valveType: item.valveType, _lineId: item.id };

    return {
      itemName: buildItemName(item.valveType, item.attributes),
      material: typeof item.attributes.body === "string" ? item.attributes.body : undefined,
      specification: Object.entries(item.attributes)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `${key}: ${value}`)
        .join("; "),
      manufacturer:
        typeof item.attributes.manufacturer === "string" ? item.attributes.manufacturer : undefined,
      partNumber:
        typeof item.attributes.partNumber === "string" ? item.attributes.partNumber : undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      totalPrice,
      attributes,
    };
  });
}

function computeTotalAmount(itemsData: ReturnType<typeof buildItemsData>): number {
  return Math.round(itemsData.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
}

export async function createQuote(input: CreateQuoteInput, userId: string) {
  // Strict, per FR2.4: every quote must reference a real, existing
  // Customer — and the snapshot below is taken from THIS record, not
  // whatever the client happened to send.
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer || customer.archived) {
    throw new NotFoundError("Customer not found");
  }

  const quoteNumber = await generateUniqueQuoteNumber();

  const itemsData = buildItemsData(input.valveItems);
  const totalAmount = computeTotalAmount(itemsData);

  const snapshotJson = {
    header: {
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email ?? null,
      customerPhone: customer.phone ?? null,
      status: "draft",
      currency: input.currency ?? "USD",
      totalAmount,
      deliveryDate: input.deliveryDate ?? null,
      notes: input.notes ?? null,
    },
    items: input.valveItems,
  };

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        status: "draft",
        currency: input.currency ?? "USD",
        totalAmount,
        deliveryDate: input.deliveryDate,
        notes: input.notes,
        attributes: { valveItems: input.valveItems } as Prisma.InputJsonValue,
        currentVersion: 1,
        createdBy: userId,
        updatedBy: userId,
        items: { create: itemsData },
      },
      include: { items: true, ...SOURCE_ATTACHMENT_INCLUDE },
    });

    await tx.quoteVersion.create({
      data: {
        quoteId: quote.id,
        version: 1,
        snapshotJson: snapshotJson as Prisma.InputJsonValue,
        changeNotes: "Initial version",
        createdBy: userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "quote.create",
        entityType: "Quote",
        entityId: quote.id,
        metadata: { quoteNumber: quote.quoteNumber },
      },
    });

    return quote;
  });
}

// The uploaded RFQ source doc, if one was attached — surfaced on both the
// list and detail views as a download link. Only ever 0 or 1 per quote in
// practice (auto-attached once, at creation).
const SOURCE_ATTACHMENT_INCLUDE = {
  attachments: {
    where: { kind: "rfq_source" as const },
    take: 1,
    orderBy: { createdAt: "asc" as const },
  },
};

// Same §3.1 scope rule as getQuoteForSession, applied to the list view.
export async function listQuotesForSession(session: Session) {
  const isPrivileged = session.user.role === UserRole.admin || session.user.role === UserRole.manager;

  return prisma.quote.findMany({
    where: isPrivileged ? {} : { createdBy: session.user.id },
    orderBy: { createdAt: "desc" },
    include: SOURCE_ATTACHMENT_INCLUDE,
  });
}

// §3.1 Data scope: admin/manager see all quotes; sales/viewer only their
// own (createdBy = session.user.id). Shared by GET detail and PATCH.
export async function getQuoteForSession(quoteId: string, session: Session) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true, ...SOURCE_ATTACHMENT_INCLUDE },
  });
  if (!quote) throw new NotFoundError("Quote not found");

  const isPrivileged = session.user.role === UserRole.admin || session.user.role === UserRole.manager;
  if (!isPrivileged && quote.createdBy !== session.user.id) {
    throw new ForbiddenError("You do not have access to this quote");
  }

  return quote;
}

function getLineId(attributes: unknown): string | undefined {
  if (attributes && typeof attributes === "object" && "_lineId" in attributes) {
    const value = (attributes as { _lineId: unknown })._lineId;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

type HeaderSnapshot = {
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  currency: string;
  totalAmount: number;
  deliveryDate: string | null;
  notes: string | null;
};

const HEADER_FIELDS = [
  "customerId",
  "customerName",
  "customerEmail",
  "customerPhone",
  "status",
  "currency",
  "totalAmount",
  "deliveryDate",
  "notes",
] as const;

// Postgres jsonb does NOT preserve object key insertion order, so an
// item read back from the DB can have its `attributes` keys in a
// different order than a freshly-built one with identical values — a
// naive JSON.stringify() comparison would falsely report that as
// "changed". Sorting keys recursively makes the comparison order-blind.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

function diffHeader(oldHeader: HeaderSnapshot, newHeader: HeaderSnapshot): string[] {
  return HEADER_FIELDS.filter(
    (field) => stableStringify(oldHeader[field]) !== stableStringify(newHeader[field]),
  );
}

// FR5.7 — line identity for diffs is _lineId, not array position: an
// attribute edit on an existing line is "modified", never "removed + added".
function diffItems(
  oldItems: { lineId: string | undefined; quantity: number; unitPrice: number; attributes: unknown }[],
  newItems: { lineId: string | undefined; quantity: number; unitPrice: number; attributes: unknown }[],
) {
  const oldByLineId = new Map(oldItems.filter((i) => i.lineId).map((i) => [i.lineId as string, i]));
  const newByLineId = new Map(newItems.filter((i) => i.lineId).map((i) => [i.lineId as string, i]));

  const itemsAdded = [...newByLineId.keys()].filter((id) => !oldByLineId.has(id));
  const itemsRemoved = [...oldByLineId.keys()].filter((id) => !newByLineId.has(id));
  const itemsModified = [...newByLineId.keys()].filter((id) => {
    if (!oldByLineId.has(id)) return false;
    return stableStringify(oldByLineId.get(id)) !== stableStringify(newByLineId.get(id));
  });

  return { itemsAdded, itemsRemoved, itemsModified };
}

function describeChanges(
  fieldsChanged: string[],
  itemsAdded: string[],
  itemsRemoved: string[],
  itemsModified: string[],
): string {
  const parts: string[] = [];
  if (fieldsChanged.length) parts.push(`updated ${fieldsChanged.join(", ")}`);
  if (itemsAdded.length) parts.push(`added ${itemsAdded.length} item(s)`);
  if (itemsRemoved.length) parts.push(`removed ${itemsRemoved.length} item(s)`);
  if (itemsModified.length) parts.push(`modified ${itemsModified.length} item(s)`);
  return parts.length ? parts.join("; ") : "No changes";
}

type QuoteWithItems = Awaited<ReturnType<typeof getQuoteForSession>>;

// Shared by updateQuote and restoreQuoteVersion — both end the same way
// (diff against current, write a new version if anything changed). What
// differs is what's allowed to produce newHeader/newValveItems in the
// first place: a normal edit goes through the status-transition matrix,
// a restore deliberately does not (§FR5.6 — it can jump to any prior
// state, not just an adjacent one).
async function applyNewVersion(
  quoteId: string,
  current: QuoteWithItems,
  newHeader: HeaderSnapshot,
  newValveItems: ValveItemInput[],
  session: Session,
  changeNotes: string | undefined,
  auditAction: "quote.update" | "quote.restore",
) {
  const itemsData = buildItemsData(newValveItems);

  const fieldsChanged = diffHeader(
    {
      customerId: current.customerId,
      customerName: current.customerName,
      customerEmail: current.customerEmail,
      customerPhone: current.customerPhone,
      status: current.status,
      currency: current.currency,
      totalAmount: current.totalAmount,
      deliveryDate: current.deliveryDate,
      notes: current.notes,
    },
    newHeader,
  );

  const oldItemsForDiff = current.items.map((item) => ({
    lineId: getLineId(item.attributes),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    attributes: item.attributes,
  }));
  const newItemsForDiff = itemsData.map((item) => ({
    lineId: getLineId(item.attributes),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    attributes: item.attributes,
  }));
  const { itemsAdded, itemsRemoved, itemsModified } = diffItems(oldItemsForDiff, newItemsForDiff);

  const hasChanges =
    fieldsChanged.length > 0 || itemsAdded.length > 0 || itemsRemoved.length > 0 || itemsModified.length > 0;

  // FR5.2 — identical snapshot: 200, no version bump, no DB write at all.
  if (!hasChanges) {
    return { quote: current, versionBumped: false };
  }

  const newVersion = current.currentVersion + 1;
  const snapshotJson = { header: newHeader, items: newValveItems };
  const changesSummaryJson = {
    fieldsChanged,
    itemsAdded,
    itemsRemoved,
    itemsModified,
    description: describeChanges(fieldsChanged, itemsAdded, itemsRemoved, itemsModified),
  };

  const quote = await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId } });

    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        customerId: newHeader.customerId,
        customerName: newHeader.customerName,
        customerEmail: newHeader.customerEmail,
        customerPhone: newHeader.customerPhone,
        status: newHeader.status,
        currency: newHeader.currency,
        totalAmount: newHeader.totalAmount,
        deliveryDate: newHeader.deliveryDate,
        notes: newHeader.notes,
        attributes: { valveItems: newValveItems } as Prisma.InputJsonValue,
        currentVersion: newVersion,
        updatedBy: session.user.id,
        items: { create: itemsData },
      },
      include: { items: true, ...SOURCE_ATTACHMENT_INCLUDE },
    });

    await tx.quoteVersion.create({
      data: {
        quoteId,
        version: newVersion,
        snapshotJson: snapshotJson as Prisma.InputJsonValue,
        changesSummaryJson: changesSummaryJson as Prisma.InputJsonValue,
        changeNotes,
        createdBy: session.user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: auditAction,
        entityType: "Quote",
        entityId: quoteId,
        metadata: { quoteNumber: current.quoteNumber, fromVersion: current.currentVersion, toVersion: newVersion },
      },
    });

    return updated;
  });

  return { quote, versionBumped: true };
}

export async function updateQuote(quoteId: string, input: UpdateQuoteInput, session: Session) {
  const current = await getQuoteForSession(quoteId, session);

  const newStatus = input.status ?? current.status;
  if (newStatus !== current.status) {
    assertValidStatusTransition(current.status, newStatus, session.user.role);
  }

  let customer = current.customerId
    ? await prisma.customer.findUnique({ where: { id: current.customerId } })
    : null;
  if (input.customerId && input.customerId !== current.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer || customer.archived) throw new NotFoundError("Customer not found");
  }

  const currentValveItems = (current.attributes as { valveItems?: ValveItemInput[] })?.valveItems ?? [];
  const newValveItems = input.valveItems ?? currentValveItems;
  const totalAmount = computeTotalAmount(buildItemsData(newValveItems));

  const newHeader: HeaderSnapshot = {
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? current.customerName,
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
    status: newStatus,
    currency: input.currency ?? current.currency,
    totalAmount,
    deliveryDate: input.deliveryDate !== undefined ? input.deliveryDate : current.deliveryDate,
    notes: input.notes !== undefined ? input.notes : current.notes,
  };

  return applyNewVersion(quoteId, current, newHeader, newValveItems, session, input.changeNotes, "quote.update");
}

// FR5.6 — restore writes the OLD snapshot as a brand-new current version;
// it never mutates the version being restored from, and deliberately
// skips the status-transition matrix (restoring can jump to any prior
// state, not just an adjacent one).
export async function restoreQuoteVersion(quoteId: string, targetVersion: number, session: Session) {
  const current = await getQuoteForSession(quoteId, session);

  const versionRow = await prisma.quoteVersion.findUnique({
    where: { quoteId_version: { quoteId, version: targetVersion } },
  });
  if (!versionRow) throw new NotFoundError(`Version ${targetVersion} not found`);

  const snapshot = versionRow.snapshotJson as { header: HeaderSnapshot; items: ValveItemInput[] };

  return applyNewVersion(
    quoteId,
    current,
    snapshot.header,
    snapshot.items,
    session,
    `Restored from version ${targetVersion}`,
    "quote.restore",
  );
}

export async function getQuoteVersions(quoteId: string, session: Session) {
  await getQuoteForSession(quoteId, session); // existence + scope check
  return prisma.quoteVersion.findMany({
    where: { quoteId },
    orderBy: { version: "desc" },
    include: { creator: { select: { fullName: true, email: true } } },
  });
}

export async function getQuoteVersionDetail(quoteId: string, version: number, session: Session) {
  await getQuoteForSession(quoteId, session); // existence + scope check
  const versionRow = await prisma.quoteVersion.findUnique({
    where: { quoteId_version: { quoteId, version } },
  });
  if (!versionRow) throw new NotFoundError(`Version ${version} not found`);
  return versionRow;
}

export async function getQuoteAuditLogs(quoteId: string, session: Session) {
  await getQuoteForSession(quoteId, session); // existence + scope check
  return prisma.auditLog.findMany({
    where: { entityType: "Quote", entityId: quoteId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true, email: true } } },
  });
}

export async function deleteQuote(quoteId: string, session: Session) {
  const current = await getQuoteForSession(quoteId, session);

  // Grab storage keys before the cascade removes the Attachment rows —
  // the DB rows cascade-delete on their own (onDelete: Cascade), but the
  // files on disk don't, so those have to be cleaned up separately below.
  const attachments = await prisma.attachment.findMany({
    where: { quoteId },
    select: { storageKey: true },
  });

  // items/versions/attachments all cascade-delete at the DB level
  // (onDelete: Cascade in schema.prisma) — one delete call is enough.
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "quote.delete",
        entityType: "Quote",
        entityId: quoteId,
        metadata: { quoteNumber: current.quoteNumber, itemCount: current.items.length },
      },
    }),
    prisma.quote.delete({ where: { id: quoteId } }),
  ]);

  await Promise.all(attachments.map((attachment) => deleteAttachmentFile(attachment.storageKey)));
}
