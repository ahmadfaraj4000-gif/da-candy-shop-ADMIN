import { useState } from "react";
import { promotionLabel, promotionTerms } from "../../promotion-pricing.js";

function dateTimeInputValue(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function PromotionForm({ promotion, inventory, onSubmit, error }) {
  const [headline, setHeadline] = useState(promotion.headline ?? "");
  const [discountType, setDiscountType] = useState(promotion.discountType);
  const [value, setValue] = useState(promotion.value);
  const [bundleQuantity, setBundleQuantity] = useState(promotion.bundleQuantity ?? 2);
  const [qualifyingPrice, setQualifyingPrice] = useState(promotion.qualifyingPrice ?? (promotion.discountType === "bundle" ? "" : 20));
  const [selectedIds, setSelectedIds] = useState(() => promotion.inventoryIds?.length ? promotion.inventoryIds : [promotion.inventoryId].filter(Boolean));
  const preview = { discountType, value: Number(value), bundleQuantity: Number(bundleQuantity), qualifyingPrice: qualifyingPrice === "" ? undefined : Number(qualifyingPrice) };

  return (
    <form className="strain-form promotion-form" onSubmit={onSubmit}>
      <label>Internal Name <input name="name" defaultValue={promotion.name} placeholder="Weekend jacket special" required /></label>
      <label>Discount Type
        <select name="discountType" value={discountType} onChange={event => {
          const next = event.target.value;
          setDiscountType(next);
          setValue(next === "bundle" ? 30 : next === "percent" ? 10 : 5);
        }}>
          <option value="percent">Percent Off</option>
          <option value="fixed">Dollar Off Each Item</option>
          <option value="bundle">Mix & Match / Quantity Bundle</option>
        </select>
      </label>
      {discountType === "bundle" && <label>Items Per Bundle <input name="bundleQuantity" type="number" min="2" step="1" value={bundleQuantity} onChange={event => setBundleQuantity(event.target.value)} required /></label>}
      <label>{discountType === "bundle" ? "Total Bundle Price ($)" : discountType === "percent" ? "Percent Off (%)" : "Dollars Off Each Item ($)"}
        <input name="value" type="number" step="0.01" min="0.01" max={discountType === "percent" ? 100 : undefined} value={value} onChange={event => setValue(event.target.value)} required />
      </label>
      {discountType === "bundle" && <>
        <label>Eligible Item Price ($, optional) <input name="qualifyingPrice" type="number" min="0.01" step="0.01" value={qualifyingPrice} onChange={event => setQualifyingPrice(event.target.value)} placeholder="Any regular price" /></label>
        <p className="muted wide">Use 20 for a deal on $20 items only. Leave blank to include every price and size of the selected products. Highest-priced eligible items are grouped first; a bundle never costs more than regular pricing.</p>
      </>}
      <fieldset className="promotion-flower-picker wide">
        <legend>Eligible Products</legend>
        <p className="muted">Select the products customers can choose from. Save a draft to add products later.</p>
        <p className="muted" role="status">{inventory.filter(product => selectedIds.includes(product._id)).length} products selected. At least one is required to publish.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="promotion-flower-grid">
          {inventory.map(product => <label className="promotion-flower-option" key={product._id}>
            <input name="inventoryIds" type="checkbox" value={product._id} checked={selectedIds.includes(product._id)} onChange={event => setSelectedIds(ids => event.target.checked ? [...ids, product._id] : ids.filter(id => id !== product._id))} />
            <span>{product.name}</span>
          </label>)}
        </div>
      </fieldset>
      <label className="wide">Public Headline <input name="headline" value={headline} onChange={event => setHeadline(event.target.value)} maxLength={60} placeholder="Mix & match: 2 for $30" required /></label>
      <label className="wide">Short Description <input name="description" defaultValue={promotion.description} maxLength={100} placeholder="Your favorite designs. One sweet deal." required /></label>
      <p className="muted wide">Keep it brief: headline up to 60 characters, description up to 100. The description appears in the pop-up.</p>
      <div className="wide" role="status" aria-live="polite">
        <p className="muted">Banner preview</p>
        <strong>{headline || "Your headline"}</strong>
        <p className="muted">{promotionLabel(preview)} · {promotionTerms(preview)}</p>
      </div>
      <label>Starts <input name="startsAt" type="datetime-local" defaultValue={dateTimeInputValue(promotion.startsAt)} /></label>
      <label>Ends <input name="endsAt" type="datetime-local" defaultValue={dateTimeInputValue(promotion.endsAt)} /></label>
      <label className="promotion-live-control wide"><input name="active" type="checkbox" defaultChecked={promotion.active ?? true} /><span><strong>Publish this promotion live</strong><small>Shows the visitor pop-up, menu banner, and automatic checkout discount.</small></span></label>
      <p className="muted wide">Leaving this unchecked saves a private draft. Publishing automatically stops any other live promotion. Offers cannot be combined with other rewards or discount codes.</p>
      <button className="primary-button wide" type="submit">Save Promotion</button>
    </form>
  );
}
