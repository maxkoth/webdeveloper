import { test } from "node:test";
import assert from "node:assert/strict";
import { isModelInvalid } from "./cache";

test("excludes banks, insurers, REITs, holding/investment cos by SIC", () => {
  assert.equal(isModelInvalid({ sic: "6022", name: "Some State Bank" }), true); // commercial bank
  assert.equal(isModelInvalid({ sic: "6311", name: "Voya Financial Inc" }), true); // life insurance
  assert.equal(isModelInvalid({ sic: "6141", name: "Regional Management Corp" }), true); // personal credit
  assert.equal(isModelInvalid({ sic: "6798", name: "Some Realty Trust" }), true); // REIT
  assert.equal(isModelInvalid({ sic: "6770", name: "Biglari Holdings Inc" }), true); // holding co
});

test("excludes MLPs / limited partnerships by name", () => {
  assert.equal(isModelInvalid({ sic: "2820", name: "Westlake Chemical Partners LP" }), true);
  assert.equal(isModelInvalid({ sic: "1311", name: "Energy Transfer L.P." }), true);
});

test("keeps normal operating companies", () => {
  assert.equal(isModelInvalid({ sic: "3571", name: "Apple Inc" }), false); // electronic computers
  assert.equal(isModelInvalid({ sic: "5411", name: "Costco Wholesale Corp" }), false); // grocery
  assert.equal(isModelInvalid({ sic: "", name: "Unknown Co" }), false); // missing sic → not excluded
});
