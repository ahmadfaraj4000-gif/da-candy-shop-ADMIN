import { Eye, Trash2 } from "lucide-react";
import { money } from "../lib/format.js";

function promoText(order) {
  if (!order.promo) return "-";
  const parts = [order.promo.label];

  if (order.promo.discountAmount) parts.push(`${money(order.promo.discountAmount)} discount`);
  if (order.promo.extraGram) parts.push("add extra 1g");
  if (order.promo.extraEighth) parts.push("add free 1/8th");
  if (order.paymentMethod === "pay_at_store") parts.push("store purchase required");
  if (order.paymentMethod === "stripe" && order.paymentStatus === "paid" && order.promo.discountAmount) parts.push("discount applied online");
  if (order.paymentMethod === "stripe" && order.paymentStatus === "paid" && (order.promo.extraGram || order.promo.extraEighth)) parts.push("paid online; give reward at pickup");
  if (order.paymentMethod === "stripe" && order.paymentStatus !== "paid") parts.push("online checkout pending");

  return parts.join(" - ");
}

export default function OrderTable({ orders, selectedIds = [], onToggle, onView, onDelete }) {
  if (orders === undefined) return <div className="state-card">Loading orders...</div>;
  if (!orders.length) return <div className="state-card">No orders match the current filters.</div>;
  const selected = new Set(selectedIds);

  return (
    <div className="table-wrap responsive-admin-table order-table">
      <table>
        <thead>
          <tr>
            <th className="select-cell">Select</th><th>Order Number</th><th>Customer Name</th><th>Phone</th><th>Pickup Date</th><th>Pickup Time</th><th>Products Ordered</th><th>Quantities</th><th>Promo</th><th>Total</th><th>Payment</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order._id}>
              <td className="select-cell" data-label="Select">
                <input
                  type="checkbox"
                  checked={selected.has(order._id)}
                  onChange={() => onToggle(order._id)}
                  aria-label={`Select order ${order.orderNumber}`}
                />
              </td>
              <td data-label="Order">{order.orderNumber}</td>
              <td data-label="Customer">{order.customerName}</td>
              <td data-label="Phone">{order.phone}</td>
              <td data-label="Pickup Date">{order.pickupDate}</td>
              <td data-label="Pickup Time">{order.pickupTime}</td>
              <td data-label="Products">{order.items?.map(item => item.name).join(", ")}</td>
              <td data-label="Quantities">{order.items?.map(item => item.quantity).join(", ")}</td>
              <td data-label="Promo">{promoText(order)}</td>
              <td data-label="Total">{money(order.total)}</td>
              <td data-label="Payment">
                <span className={`payment-status ${order.paymentStatus || "pending"}`}>
                  {order.paymentMethod === "stripe" ? "Online" : "Store"} - {order.paymentStatus || "pending"}
                </span>
              </td>
              <td className="actions">
                <div className="action-group">
                  <button className="icon-button" onClick={() => onView(order)} title="View order"><Eye size={17} /></button>
                  <button className="icon-button danger" onClick={() => onDelete(order)} title="Delete order"><Trash2 size={17} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
