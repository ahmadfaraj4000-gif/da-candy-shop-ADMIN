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
  }
};

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

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [viewOrder, setViewOrder] = useState(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const toast = useToast();
  const debouncedSearch = useDebounce(search);

  const orderArgs = status ? { search: debouncedSearch, status } : { search: debouncedSearch };
  const inventoryArgs = type ? { search: debouncedSearch, strainType: type } : { search: debouncedSearch };
  const orders = useQuery(convexApi.orders.listOrders, orderArgs);
  const inventory = useQuery(convexApi.inventory.listInventory, inventoryArgs);
  const qrPayments = useQuery(convexApi.payments.listInStorePayments, {});
  const updateStatus = useMutation(convexApi.orders.updateOrderStatus);
  const deleteOrder = useMutation(convexApi.orders.deleteOrder);
  const upsertStrain = useMutation(convexApi.inventory.upsertStrain);
  const deleteStrain = useMutation(convexApi.inventory.deleteStrain);

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
    await updateStatus({ id, status: nextStatus });
    toast.push("Order status updated.");
  }

  function handleDeleteOrder(order) {
    setDeleteOrderTarget(order);
  }

  async function confirmDeleteOrder() {
    if (!deleteOrderTarget) return;
    await deleteOrder({ id: deleteOrderTarget._id });
    setDeleteOrderTarget(null);
    toast.push("Order deleted.");
  }

  async function handleDeleteStrain(id) {
    if (!confirm("Delete this strain?")) return;
    await deleteStrain({ id });
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
          {!["orders", "payments", "inventory"].includes(activeTab) && (
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
            <p><strong>Promo</strong>{viewOrder.promo ? `${viewOrder.promo.label}${viewOrder.promo.discountAmount ? ` - ${money(viewOrder.promo.discountAmount)} discount` : ""}${viewOrder.promo.extraGram ? " - add extra 1g" : ""}` : "None"}</p>
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
