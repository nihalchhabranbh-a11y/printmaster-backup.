/**
 * money.js — Currency math helpers
 *
 * All monetary arithmetic should flow through these helpers to prevent
 * floating-point drift accumulation (e.g. 0.1 + 0.2 ≠ 0.3 in IEEE-754).
 * Rounding is applied at each intermediate step, not only at display time.
 */

/**
 * Round to exactly 2 decimal places (standard .5-rounds-up, matching
 * Indian taxation expectations — same as Java's HALF_UP mode).
 *
 * @param {number} n
 * @returns {number}
 */
export const roundCurrency = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Safe addition — rounds after adding to prevent drift.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const addMoney = (a, b) => roundCurrency((Number(a) || 0) + (Number(b) || 0));

/**
 * Safe multiplication — rounds the product (use for qty × rate, rate × taxPct).
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const mulMoney = (a, b) => roundCurrency((Number(a) || 0) * (Number(b) || 0));

/**
 * Apply a percentage to an amount and return the rounded result.
 * @param {number} amount  - base amount
 * @param {number} pct     - percentage (e.g. 18 for 18 %)
 * @returns {number}
 */
export const applyPct = (amount, pct) =>
  roundCurrency((Number(amount) || 0) * (Number(pct) || 0) / 100);

/**
 * Format a number as an Indian Rupee string (₹ symbol, 2 d.p., en-IN grouping).
 * @param {number} n
 * @returns {string}
 */
export const fmtCurrency = (n) =>
  `₹${roundCurrency(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
