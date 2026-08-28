import type {
  BuyerType,
  RoleCode,
  UserStatus
} from "../../generated/prisma/enums.js";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { writeAudit } from "../audit/audit.service.js";

export async function listUsers(input: {
  status?: UserStatus | undefined;
  role?: RoleCode | undefined;
  limit: number;
  cursor?: string | undefined;
}) {
  const users = await getPrisma().user.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.role ? { roles: { some: { roleCode: input.role } } } : {})
    },
    orderBy: { id: "asc" },
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      displayName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      roles: { orderBy: { roleCode: "asc" }, select: { roleCode: true, assignedAt: true } }
    }
  });
  const hasMore = users.length > input.limit;
  const data = hasMore ? users.slice(0, input.limit) : users;
  return {
    data,
    nextCursor: hasMore ? data.at(-1)?.id ?? null : null
  };
}

export async function updateUserStatus(
  actorUserId: string,
  userId: string,
  status: Extract<UserStatus, "ACTIVE" | "SUSPENDED">,
  context: RequestContext
) {
  if (actorUserId === userId) {
    throw new AppError(409, "ADMIN_SELF_CHANGE_FORBIDDEN", "Administrators cannot change their own status");
  }
  return getPrisma().$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true }
    });
    if (!user || user.status === "DELETED") {
      throw new AppError(404, "USER_NOT_FOUND", "The user does not exist");
    }
    const updated = await transaction.user.update({
      where: { id: userId },
      data: { status, version: { increment: 1 } },
      select: { id: true, displayName: true, status: true, updatedAt: true }
    });
    if (status === "SUSPENDED") {
      await transaction.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    await writeAudit(transaction, {
      actorUserId,
      actionCode: "ADMIN_USER_STATUS_CHANGED",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { previousStatus: user.status, status }
    });
    return updated;
  });
}

export async function replaceUserRoles(
  actorUserId: string,
  userId: string,
  roles: RoleCode[],
  buyerType: BuyerType | undefined,
  context: RequestContext
) {
  if (actorUserId === userId) {
    throw new AppError(409, "ADMIN_SELF_CHANGE_FORBIDDEN", "Administrators cannot change their own roles");
  }
  return getPrisma().$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      include: { farmerProfile: true, buyerProfile: true }
    });
    if (!user || user.status === "DELETED") {
      throw new AppError(404, "USER_NOT_FOUND", "The user does not exist");
    }
    if (roles.includes("BUYER") && !user.buyerProfile && !buyerType) {
      throw new AppError(
        422,
        "BUYER_TYPE_REQUIRED",
        "buyerType is required when assigning BUYER for the first time"
      );
    }
    await transaction.userRole.deleteMany({
      where: { userId, roleCode: { notIn: roles } }
    });
    await transaction.userRole.createMany({
      data: roles.map((roleCode) => ({ userId, roleCode, assignedByUserId: actorUserId })),
      skipDuplicates: true
    });
    if (roles.includes("FARMER") && !user.farmerProfile) {
      await transaction.farmerProfile.create({ data: { userId } });
    }
    if (roles.includes("BUYER") && !user.buyerProfile && buyerType) {
      await transaction.buyerProfile.create({ data: { userId, buyerType } });
    }
    await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await transaction.user.update({
      where: { id: userId },
      data: { version: { increment: 1 } }
    });
    await writeAudit(transaction, {
      actorUserId,
      actionCode: "ADMIN_USER_ROLES_REPLACED",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { roles: roles.join(",") }
    });
    return transaction.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        status: true,
        roles: { orderBy: { roleCode: "asc" }, select: { roleCode: true, assignedAt: true } }
      }
    });
  });
}
