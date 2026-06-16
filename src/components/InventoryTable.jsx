import { Edit, Trash2 } from "lucide-react";
import { money } from "../lib/format.js";

export default function InventoryTable({ inventory, onEdit, onDelete }) {
  if (inventory === undefined) return <div className="state-card">Loading inventory...</div>;
  if (!inventory.length) return <div className="state-card">No strains match the current filters.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Type</th><th>Price</th><th>THC</th><th>CBD</th><th>Potency</th><th>Inventory Quantity</th><th>Featured</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map(strain => (
            <tr key={strain._id}>
              <td>{strain.name}</td>
              <td>{strain.strainType}</td>
              <td>{money(strain.price)}</td>
              <td>{strain.thc}%</td>
              <td>{strain.cbd}%</td>
              <td>{strain.potency}</td>
              <td>{strain.quantity}</td>
              <td>{strain.featured ? "Yes" : "No"}</td>
              <td className="actions">
                <button className="icon-button" onClick={() => onEdit(strain)} title="Edit strain"><Edit size={17} /></button>
                <button className="icon-button danger" onClick={() => onDelete(strain._id)} title="Delete strain"><Trash2 size={17} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
