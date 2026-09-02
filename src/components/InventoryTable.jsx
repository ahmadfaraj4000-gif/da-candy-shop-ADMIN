import { Edit, Trash2 } from "lucide-react";
import { money } from "../lib/format.js";

function imageSrc(image) {
  if (!image) return "";
  if (image.startsWith("assets/")) return `../${image}`;
  return image;
}

const weightLabels = { eighth: "3.5g", quarter: "7g", half: "14g", ounce: "28g" };

function priceSummary(strain) {
  const prices = strain.weightPrices && Object.keys(strain.weightPrices).length
    ? strain.weightPrices
    : { eighth: strain.price };
  return Object.entries(prices)
    .filter(([, price]) => Number(price) > 0)
    .map(([key, price]) => `${weightLabels[key] || key} ${money(price)}`)
    .join(" · ");
}

export default function InventoryTable({ inventory, onEdit, onDelete }) {
  if (inventory === undefined) return <div className="state-card">Loading inventory...</div>;
  if (!inventory.length) return <div className="state-card">No strains match the current filters.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Image</th><th>Name</th><th>Type</th><th>Prices</th><th>Potency</th><th>Featured</th><th>Availability</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map(strain => (
            <tr key={strain._id}>
              <td data-label="Image">
                {strain.image ? <img className="inventory-thumb" src={imageSrc(strain.image)} alt={strain.name} /> : <span className="muted">No image</span>}
              </td>
              <td data-label="Name">{strain.name}</td>
              <td data-label="Type">{strain.strainType}</td>
              <td data-label="Prices" className="inventory-prices">{priceSummary(strain)}</td>
              <td data-label="Potency">{strain.potency}</td>
              <td data-label="Featured">{strain.featured ? "Featured" : "-"}</td>
              <td data-label="Availability">{(strain.available ?? Number(strain.quantity ?? 0) > 0) ? "Available" : "Not Available"}</td>
              <td className="actions">
                <div className="action-group">
                  <button className="icon-button" onClick={() => onEdit(strain)} title="Edit strain"><Edit size={17} /></button>
                  <button className="icon-button danger" onClick={() => onDelete(strain._id)} title="Delete strain"><Trash2 size={17} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
