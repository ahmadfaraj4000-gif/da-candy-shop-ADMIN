import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Filters from "../components/Filters.jsx";
import OrderTable from "../components/OrderTable.jsx";
import InventoryTable from "../components/InventoryTable.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { money } from "../lib/format.js";
import { useDebounce } from "../hooks/useDebounce.js";

const blankStrain = { name: "", strainType: "Hybrid", price: 10, onlinePrice: 10, potency: "Medium", description: "", image: "", available: true };
const convexApi = {
  orders: {
    listOrders: makeFunctionReference("orders:listOrders"),
    updateOrderStatus: makeFunctionReference("orders:updateOrderStatus"),
    deleteOrder: makeFunctionReference("orders:deleteOrder")
  },
  inventory: {
    listInventory: makeFunctionReference("inventory:listInventory"),
    upsertStrain: makeFunctionReference("inventory:upsertStrain"),
    deleteStrain: makeFunctionReference("inventory:deleteStrain")
  },
  payments: {
    listInStorePayments: makeFunctionReference("payments:listInStorePayments")
  },
  discountCodes: {
    listDiscountCodes: makeFunctionReference("discountCodes:listDiscountCodes"),
    upsertDiscountCode: makeFunctionReference("discountCodes:upsertDiscountCode"),
    deleteDiscountCode: makeFunctionReference("discountCodes:deleteDiscountCode")
  }
};

const blankDiscountCode = { code: "", type: "percent", value: 10, active: true, maxUses: undefined, expiresAt: "", note: "" };

function imageFileToDataUrl(file) {
  if (!file || file.size === 0) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Image could not be loaded."));
      image.onload = () => {
        const maxSize = 600;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/webp", 0.72);
        if (dataUrl.length > 700000) {
          reject(new Error("Image is too large. Try a smaller photo."));
          return;
        }
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function imageSrc(image) {
  if (!image) return "";
  if (image.startsWith("assets/")) return `../${image}`;
  return image;
}

function numberFromForm(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function promoDetail(order) {
  if (!order?.promo) return "None";
  const parts = [order.promo.label];

  if (order.promo.discountAmount) parts.push(`${money(order.promo.discountAmount)} discount`);
  if (order.promo.extraGram) parts.push("add extra 1g");
  if (order.promo.extraEighth) parts.push("add free 1/8th");
  if (order.paymentMethod === "pay_at_store") parts.push("customer chose pay at store; honor after completed pickup purchase");
  if (order.paymentMethod === "stripe" && order.paymentStatus === "paid" && order.promo.discountAmount) parts.push("discount applied online");
  if (order.paymentMethod === "stripe" && order.paymentStatus === "paid" && (order.promo.extraGram || order.promo.extraEighth)) parts.push("paid online; give reward at pickup");
  if (order.paymentMethod === "stripe" && order.paymentStatus !== "paid") parts.push("online checkout pending");

  return parts.join(" - ");
}

export default function Dashboard({ adminToken, onLogout }) {
  const [activeTab, setActiveTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [viewOrder, setViewOrder] = useState(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const toast = useToast();
  const debouncedSearch = useDebounce(search);

  const orderArgs = status ? { adminToken, search: debouncedSearch, status } : { adminToken, search: debouncedSearch };
  const inventoryArgs = type ? { search: debouncedSearch, strainType: type } : { search: debouncedSearch };
  const orders = useQuery(convexApi.orders.listOrders, orderArgs);
  const inventory = useQuery(convexApi.inventory.listInventory, inventoryArgs);
  const qrPayments = useQuery(convexApi.payments.listInStorePayments, { adminToken });
  const discountCodes = useQuery(convexApi.discountCodes.listDiscountCodes, { adminToken });
  const updateStatus = useMutation(convexApi.orders.updateOrderStatus);
  const deleteOrder = useMutation(convexApi.orders.deleteOrder);
  const upsertStrain = useMutation(convexApi.inventory.upsertStrain);
  const deleteStrain = useMutation(convexApi.inventory.deleteStrain);
  const upsertDiscountCode = useMutation(convexApi.discountCodes.upsertDiscountCode);
  const deleteDiscountCode = useMutation(convexApi.discountCodes.deleteDiscountCode);

  useEffect(() => {
    setImagePreview(editing?.image || "");
  }, [editing]);

  const metrics = useMemo(() => {
    const orderList = orders || [];
    const paidQrPayments = (qrPayments || []).filter(payment => payment.status === "paid");
    return {
      pending: orderList.filter(order => order.status === "Pending").length,
      ready: orderList.filter(order => order.status === "Ready").length,
      revenue: orderList.reduce((sum, order) => sum + Number(order.total || 0), 0),
      qrRevenue: paidQrPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    };
  }, [orders, qrPayments]);

  async function handleStatus(id, nextStatus) {
    await updateStatus({ adminToken, id, status: nextStatus });
    toast.push("Order status updated.");
  }

  function handleDeleteOrder(order) {
    setDeleteOrderTarget(order);
  }

  async function confirmDeleteOrder() {
    if (!deleteOrderTarget) return;
    await deleteOrder({ adminToken, id: deleteOrderTarget._id });
    setDeleteOrderTarget(null);
    toast.push("Order deleted.");
  }

  async function handleDeleteStrain(id) {
    if (!confirm("Delete this strain?")) return;
    await deleteStrain({ adminToken, id });
    toast.push("Strain deleted.");
  }

  async function saveStrain(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const form = Object.fromEntries(formData);
    const submitButton = formElement.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
      const pickupPrice = numberFromForm(form.price);
      const onlinePrice = numberFromForm(form.onlinePrice, pickupPrice);
      const uploadedImage = await imageFileToDataUrl(formData.get("imageFile"));
      const image = uploadedImage || String(form.image || "").trim() || editing?.image || "";

      await upsertStrain({
        adminToken,
        id: editing?._id,
        name: form.name,
        strainType: form.strainType,
        description: form.description,
        image,
        potency: form.potency,
        price: pickupPrice,
        onlinePrice,
        available: form.available === "on"
      });
      setEditing(null);
      toast.push("Inventory saved.");
    } catch (error) {
      toast.push(error.message || "Inventory could not be saved.", "error");
      submitButton.disabled = false;
      submitButton.textContent = "Save Strain";
    }
  }

  async function saveDiscountCode(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const type = form.type;
    const value = type === "free_1g" || type === "free_eighth" ? undefined : numberFromForm(form.value);
    const maxUses = form.maxUses ? numberFromForm(form.maxUses) : undefined;
    const expiresAt = form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).getTime() : undefined;

    try {
      await upsertDiscountCode({
        adminToken,
        id: editingDiscount?._id,
        code: form.code,
        type,
        value,
        active: form.active === "on",
        maxUses,
        expiresAt,
        note: form.note
      });
      setEditingDiscount(null);
      toast.push("Discount code saved.");
    } catch (error) {
      toast.push(error.message || "Discount code could not be saved.", "error");
    }
  }

  async function handleDeleteDiscountCode(id) {
    await deleteDiscountCode({ adminToken, id });
    toast.push("Discount code deleted.");
  }

  async function handleImageFileChange(event) {
    try {
      const preview = await imageFileToDataUrl(event.target.files?.[0]);
      if (preview) setImagePreview(preview);
    } catch (error) {
      toast.push(error.message || "Image could not be previewed.", "error");
      event.target.value = "";
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setSearch("");
    setStatus("");
    setType("");
  }

  return (
    <>
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} onLogout={onLogout} />
      <main className="dashboard">
        <section className="metric-grid">
          <article><span>Pending</span><strong>{metrics.pending}</strong></article>
          <article><span>Ready</span><strong>{metrics.ready}</strong></article>
          <article><span>{activeTab === "payments" ? "Paid QR Total" : "Current Total"}</span><strong>{money(activeTab === "payments" ? metrics.qrRevenue : metrics.revenue)}</strong></article>
        </section>
        <section className="panel">
          <div className="panel-toolbar">
            <SearchBar value={search} onChange={setSearch} placeholder={activeTab === "orders" ? "Search orders" : activeTab === "payments" ? "Search QR payments" : "Search strains"} />
            {activeTab === "orders" && <Filters status={status} onStatusChange={setStatus} />}
            {activeTab === "inventory" && <Filters type={type} onTypeChange={setType} />}
            {activeTab === "inventory" && <button className="primary-button" onClick={() => setEditing(blankStrain)}><Plus size={18} /> Add Strain</button>}
            {activeTab === "discounts" && <button className="primary-button" onClick={() => setEditingDiscount(blankDiscountCode)}><Plus size={18} /> Add Code</button>}
          </div>
          {activeTab === "orders" && (
            <OrderTable orders={orders} onView={setViewOrder} onStatus={handleStatus} onDelete={handleDeleteOrder} />
          )}
          {activeTab === "payments" && (
            <QrPaymentTable payments={qrPayments} search={debouncedSearch} />
          )}
          {activeTab === "inventory" && (
            <InventoryTable inventory={inventory} onEdit={setEditing} onDelete={handleDeleteStrain} />
          )}
          {activeTab === "discounts" && (
            <DiscountCodeTable codes={discountCodes} onEdit={setEditingDiscount} onDelete={handleDeleteDiscountCode} />
          )}
          {!["orders", "payments", "inventory", "discounts"].includes(activeTab) && (
            <div className="state-card">Choose an admin section.</div>
          )}
        </section>
      </main>
      <Footer />

      {viewOrder && (
        <Modal title={`Order ${viewOrder.orderNumber}`} onClose={() => setViewOrder(null)}>
          <div className="detail-list">
            <p><strong>Customer</strong>{viewOrder.customerName}</p>
            <p><strong>Phone</strong>{viewOrder.phone}</p>
            <p><strong>Pickup</strong>{viewOrder.pickupDate} at {viewOrder.pickupTime}</p>
            <p><strong>Status</strong>{viewOrder.status}</p>
            <p><strong>Total</strong>{money(viewOrder.total)}</p>
            <p><strong>Promo</strong>{promoDetail(viewOrder)}</p>
          </div>
          <h3>Products Ordered</h3>
          {viewOrder.items?.map(item => <p key={`${item.productId}-${item.name}`}>{item.name} x {item.quantity}</p>)}
        </Modal>
      )}

      {deleteOrderTarget && (
        <Modal title="Delete Order" onClose={() => setDeleteOrderTarget(null)}>
          <div className="delete-confirm">
            <p className="delete-confirm-kicker">This cannot be undone.</p>
            <h3>{deleteOrderTarget.orderNumber}</h3>
            <p>
              Delete this order for <strong>{deleteOrderTarget.customerName}</strong>?
              It will be removed from the admin order list.
            </p>
            <div className="delete-confirm-actions">
              <button className="icon-button" type="button" onClick={() => setDeleteOrderTarget(null)}>Cancel</button>
              <button className="primary-button danger-action" type="button" onClick={confirmDeleteOrder}>Delete Order</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={editing._id ? "Edit Strain" : "Add Strain"} onClose={() => setEditing(null)}>
          <form className="strain-form" onSubmit={saveStrain}>
            <label>Name <input name="name" defaultValue={editing.name} required /></label>
            <label>Type <select name="strainType" defaultValue={editing.strainType}><option>Indica</option><option>Sativa</option><option>Hybrid</option></select></label>
            <label>Pickup Price <input name="price" type="number" step="0.01" min="0.01" defaultValue={editing.price} required /></label>
            <label>Online Price <input name="onlinePrice" type="number" step="0.01" min="0.01" defaultValue={editing.onlinePrice ?? editing.price} required /></label>
            <label>Potency <select name="potency" defaultValue={editing.potency}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label>Image URL <input name="image" defaultValue={editing.image?.startsWith("data:") ? "" : editing.image} placeholder="Paste image URL or upload below" /></label>
            <label>Upload Image <input name="imageFile" type="file" accept="image/*" onChange={handleImageFileChange} /></label>
            {imagePreview && (
              <div className="image-preview wide">
                <img src={imageSrc(imagePreview)} alt={`${editing.name || "Strain"} preview`} />
              </div>
            )}
            <label className="checkbox-row"><input name="available" type="checkbox" defaultChecked={editing.available ?? Number(editing.quantity ?? 0) > 0} /> Available</label>
            <label className="wide">Description <textarea name="description" rows="4" defaultValue={editing.description} required /></label>
            <button className="primary-button wide" type="submit">Save Strain</button>
          </form>
        </Modal>
      )}

      {editingDiscount && (
        <Modal title={editingDiscount._id ? "Edit Discount Code" : "Add Discount Code"} onClose={() => setEditingDiscount(null)}>
          <form className="strain-form" onSubmit={saveDiscountCode}>
            <label>Code <input name="code" defaultValue={editingDiscount.code} required /></label>
            <label>Type
              <select name="type" defaultValue={editingDiscount.type}>
                <option value="percent">Percent Off</option>
                <option value="fixed">Dollar Amount Off</option>
                <option value="free_1g">Free 1g</option>
                <option value="free_eighth">Free 1/8th</option>
              </select>
            </label>
            <label>Value <input name="value" type="number" step="0.01" min="0" defaultValue={editingDiscount.value ?? ""} /></label>
            <label>Max Uses <input name="maxUses" type="number" min="1" defaultValue={editingDiscount.maxUses ?? ""} /></label>
            <label>Expires <input name="expiresAt" type="date" defaultValue={editingDiscount.expiresAt ? new Date(editingDiscount.expiresAt).toISOString().slice(0, 10) : ""} /></label>
            <label className="checkbox-row"><input name="active" type="checkbox" defaultChecked={editingDiscount.active ?? true} /> Active</label>
            <label className="wide">Note <textarea name="note" rows="3" defaultValue={editingDiscount.note || ""} /></label>
            <button className="primary-button wide" type="submit">Save Code</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function QrPaymentTable({ payments, search }) {
  if (payments === undefined) return <div className="state-card">Loading QR payments...</div>;

  const query = search.trim().toLowerCase();
  const rows = query
    ? payments.filter(payment =>
        [payment.customerName, payment.note, payment.status, payment.stripeSessionId, payment.stripePaymentIntentId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : payments;

  if (!rows.length) return <div className="state-card">No QR payments match the current search.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Amount</th><th>Status</th><th>Name</th><th>Note</th><th>Stripe Session</th><th>Payment Intent</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(payment => (
            <tr key={payment._id}>
              <td data-label="Amount">{money(payment.amount)}</td>
              <td data-label="Status"><span className={`payment-status ${payment.status}`}>{payment.status}</span></td>
              <td data-label="Name">{payment.customerName || "Walk-in"}</td>
              <td data-label="Note">{payment.note || "-"}</td>
              <td data-label="Stripe Session">{payment.stripeSessionId || "-"}</td>
              <td data-label="Payment Intent">{payment.stripePaymentIntentId || "-"}</td>
              <td data-label="Created">{new Date(payment.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function discountLabel(code) {
  if (code.type === "percent") return `${code.value}% off`;
  if (code.type === "fixed") return `${money(code.value)} off`;
  if (code.type === "free_1g") return "Free 1g";
  if (code.type === "free_eighth") return "Free 1/8th";
  return code.type;
}

function DiscountCodeTable({ codes, onEdit, onDelete }) {
  if (codes === undefined) return <div className="state-card">Loading discount codes...</div>;
  if (!codes.length) return <div className="state-card">No discount codes yet.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Reward</th><th>Status</th><th>Uses</th><th>Expires</th><th>Note</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {codes.map(code => (
            <tr key={code._id}>
              <td data-label="Code">{code.code}</td>
              <td data-label="Reward">{discountLabel(code)}</td>
              <td data-label="Status"><span className={`payment-status ${code.active ? "paid" : "failed"}`}>{code.active ? "Active" : "Inactive"}</span></td>
              <td data-label="Uses">{code.uses}{code.maxUses ? ` / ${code.maxUses}` : ""}</td>
              <td data-label="Expires">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "-"}</td>
              <td data-label="Note">{code.note || "-"}</td>
              <td className="actions">
                <div className="action-group">
                  <button className="icon-button" type="button" onClick={() => onEdit(code)}>Edit</button>
                  <button className="icon-button danger" type="button" onClick={() => onDelete(code._id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
