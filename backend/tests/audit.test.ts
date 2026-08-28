import { describe, expect, it } from "vitest";
import {
  computeAuditEventHash,
  verifyAuditEventHash,
  type AuditInput
} from "../src/modules/audit/audit.service.js";

const input: AuditInput = {
  actorUserId: "00000000-0000-4000-8000-000000000001",
  actionCode: "TEST_ACTION",
  entityType: "USER",
  entityId: "00000000-0000-4000-8000-000000000002",
  outcome: "SUCCESS",
  requestId: "00000000-0000-4000-8000-000000000003",
  metadata: { allowed: true }
};

describe("audit chain", () => {
  it("binds every event hash to the previous event", () => {
    const occurredAt = new Date("2026-08-28T05:20:00.123Z");
    const first = computeAuditEventHash(input, occurredAt, null);
    const second = computeAuditEventHash(input, occurredAt, first);
    expect(second).not.toEqual(first);
    expect(verifyAuditEventHash(input, occurredAt, first, second)).toBe(true);
    expect(verifyAuditEventHash(input, occurredAt, null, second)).toBe(false);
  });
});
