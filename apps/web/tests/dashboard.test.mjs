import test from "node:test";
import assert from "node:assert/strict";
import { summarizeApplications } from "../app/lib/dashboard.ts";

test("empty workspace reports zero rather than invalid rates", () => {
  assert.deepEqual(summarizeApplications([]), {
    total: 0,
    submitted: 0,
    responses: 0,
    rejected: 0,
    waiting: 0,
    offers: 0,
  });
});
test("counts each stage and treats rejection as a response", () => {
  const states = [
    "WISHLIST",
    "APPLIED",
    "APPLIED_PENDING_TEST",
    "SCREENING",
    "TECHNICAL_INTERVIEW",
    "FINAL_INTERVIEW",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
  ];
  assert.deepEqual(
    summarizeApplications(states.map((status) => ({ status }))),
    {
      total: 9,
      submitted: 8,
      responses: 5,
      rejected: 1,
      waiting: 1,
      offers: 1,
    },
  );
});
test("a stage change updates waiting, responses and rejections consistently", () => {
  const applications = [{ status: "APPLIED" }, { status: "WISHLIST" }];
  assert.equal(summarizeApplications(applications).waiting, 1);
  applications[0].status = "REJECTED";
  assert.deepEqual(summarizeApplications(applications), {
    total: 2,
    submitted: 1,
    responses: 1,
    rejected: 1,
    waiting: 0,
    offers: 0,
  });
  applications[0].status = "WITHDRAWN";
  assert.equal(summarizeApplications(applications).responses, 0);
});
