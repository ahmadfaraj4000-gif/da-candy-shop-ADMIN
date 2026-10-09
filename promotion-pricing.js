/** @typedef {{discountType: string, value: number, bundleQuantity?: number, qualifyingPrice?: number, inventoryIds?: string[], inventoryId?: string}} Promotion */
/** @typedef {{inventoryId?: string, price: number, quantity: number}} PromotionItem */

const cents = value => Math.round(Number(value) * 100);
const money = value => `$${Number(value).toFixed(2).replace(/\.00$/, "")}`;

/** @param {Promotion} promotion */
export function promotionLabel(promotion) {
  if (promotion.discountType === "bundle") return `Mix & match ${promotion.bundleQuantity} for ${money(promotion.value)}`;
  if (promotion.discountType === "percent") return `${Number(promotion.value)}% off`;
  return `${money(promotion.value)} off each`;
}

/** @param {Promotion} promotion */
export function promotionTerms(promotion) {
  if (promotion.discountType !== "bundle" || promotion.qualifyingPrice === undefined) return "Selected items";
  return `Selected ${money(promotion.qualifyingPrice)} items`;
}

/** @param {Promotion} promotion @param {PromotionItem} item */
export function isPromotionItemEligible(promotion, item) {
  const ids = promotion.inventoryIds?.length ? promotion.inventoryIds : [promotion.inventoryId];
  return Boolean(item.inventoryId && ids.includes(item.inventoryId)
    && (promotion.discountType !== "bundle" || promotion.qualifyingPrice === undefined
      || cents(item.price) === cents(promotion.qualifyingPrice)));
}

/** Shared by the storefront and authoritative server-side order pricing.
 * @param {Promotion | null | undefined} promotion
 * @param {PromotionItem[]} items
 */
export function calculatePromotionDiscount(promotion, items) {
  if (!promotion || !Number.isFinite(promotion.value) || promotion.value <= 0) return 0;
  const eligible = items.filter(item => isPromotionItemEligible(promotion, item)
    && Number.isSafeInteger(item.quantity) && item.quantity > 0
    && Number.isFinite(item.price) && item.price > 0);
  const subtotal = eligible.reduce((sum, item) => sum + cents(item.price) * item.quantity, 0);
  if (promotion.discountType === "percent") return Math.min(subtotal, Math.round(subtotal * promotion.value / 100)) / 100;
  if (promotion.discountType === "fixed") {
    const quantity = eligible.reduce((sum, item) => sum + item.quantity, 0);
    return Math.min(subtotal, cents(promotion.value) * quantity) / 100;
  }
  const size = promotion.bundleQuantity;
  if (promotion.discountType !== "bundle" || !Number.isSafeInteger(size) || !size || size < 2) return 0;
  const target = cents(promotion.value);
  let pendingCount = 0;
  let pendingSubtotal = 0;
  let discount = 0;
  // Highest-priced units form bundles first. Never raise a cheaper bundle's price.
  for (const item of eligible.sort((a, b) => cents(b.price) - cents(a.price))) {
    const price = cents(item.price);
    let remaining = item.quantity;
    while (remaining > 0) {
      if (!pendingCount && remaining >= size) {
        const bundles = Math.floor(remaining / size);
        discount += bundles * Math.max(0, size * price - target);
        remaining %= size;
      } else {
        const take = Math.min(size - pendingCount, remaining);
        pendingCount += take;
        pendingSubtotal += take * price;
        remaining -= take;
        if (pendingCount === size) {
          discount += Math.max(0, pendingSubtotal - target);
          pendingCount = 0;
          pendingSubtotal = 0;
        }
      }
    }
  }
  return Math.min(subtotal, discount) / 100;
}
