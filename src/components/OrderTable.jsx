import { Eye, Trash2 } from "lucide-react";
import { money } from "../lib/format.js";

const statuses = ["Pending", "Ready", "Completed", "Cancelled"];

export default function OrderTable({ orders, onView, onStatus, onDelete }) {
  if (orders === undefined) return <div className="state-card">Loading orders...</div>;
  if (!orders.length) return <div className="state-card">No orders match the current filters.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order Number</th><th>Customer Name</th><th>Phone</th><th>Pickup Date</th><th>Pickup Time</th><th>Products Ordered</th><th>Quantities</th><th>Total</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order._id}>
              <td>{order.orderNumber}</td>
              <td>{order.customerName}</td>
              <td>{order.phone}</td>
              <td>{order.pickupDate}</td>
              <td>{order.pickupTime}</td>
              <td>{order.items?.map(item => item.name).join(", ")}</td>
              <td>{order.items?.map(item => item.quantity).join(", ")}</td>
              <td>{money(order.total)}</td>
              <td>
                <select value={order.status} onChange={event => onStatus(order._id, event.target.value)}>
                  {statuses.map(status => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td className="actions">
                <button className="icon-button" onClick={() => onView(order)} title="View order"><Eye size={17} /></button>
                <button className="icon-button danger" onClick={() => onDelete(order._id)} title="Delete order"><Trash2 size={17} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
