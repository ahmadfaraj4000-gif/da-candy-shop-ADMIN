import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
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

const blankStrain = { name: "", strainType: "Hybrid", price: 35, thc: 20, cbd: 1, potency: "Medium", description: "", image: "", quantity: 10, featured: false };
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
  }
};

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [viewOrder, setViewOrder] = useState(null);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const debouncedSearch = useDebounce(search);

  const orderArgs = status ? { search: debouncedSearch, status } : { search: debouncedSearch };
  const inventoryArgs = type ? { search: debouncedSearch, strainType: type } : { search: debouncedSearch };
  const orders = useQuery(convexApi.orders.listOrders, orderArgs);
  const inventory = useQuery(convexApi.inventory.listInventory, inventoryArgs);
  const updateStatus = useMutation(convexApi.orders.updateOrderStatus);
  const deleteOrder = useMutation(convexApi.orders.deleteOrder);
  const upsertStrain = useMutation(convexApi.inventory.upsertStrain);
  const deleteStrain = useMutation(convexApi.inventory.deleteStrain);

  const metrics = useMemo(() => {
    const orderList = orders || [];
    return {
      pending: orderList.filter(order => order.status === "Pending").length,
      ready: orderList.filter(order => order.status === "Ready").length,
      revenue: orderList.reduce((sum, order) => sum + Number(order.total || 0), 0)
    };
  }, [orders]);

  async function handleStatus(id, nextStatus) {
    await updateStatus({ id, status: nextStatus });
    toast.push("Order status updated.");
  }

  async function handleDeleteOrder(id) {
    if (!confirm("Delete this order?")) return;
    await deleteOrder({ id });
    toast.push("Order deleted.");
  }

  async function handleDeleteStrain(id) {
    if (!confirm("Delete this strain?")) return;
    await deleteStrain({ id });
    toast.push("Strain deleted.");
  }

  async function saveStrain(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    await upsertStrain({
      id: editing?._id,
      name: form.name,
      strainType: form.strainType,
      description: form.description,
      image: form.image,
      potency: form.potency,
      price: Number(form.price),
      thc: Number(form.thc),
      cbd: Number(form.cbd),
      quantity: Number(form.quantity),
      featured: form.featured === "on"
    });
    setEditing(null);
    toast.push("Inventory saved.");
  }

  return (
    <>
      <Navbar activeTab={activeTab} onTabChange={tab => { setActiveTab(tab); setSearch(""); }} onLogout={onLogout} />
      <main className="dashboard">
        <section className="metric-grid">
          <article><span>Pending</span><strong>{metrics.pending}</strong></article>
          <article><span>Ready</span><strong>{metrics.ready}</strong></article>
          <article><span>Current Total</span><strong>{money(metrics.revenue)}</strong></article>
        </section>
        <section className="panel">
          <div className="panel-toolbar">
            <SearchBar value={search} onChange={setSearch} placeholder={activeTab === "orders" ? "Search orders" : "Search strains"} />
            {activeTab === "orders" ? <Filters status={status} onStatusChange={setStatus} /> : <Filters type={type} onTypeChange={setType} />}
            {activeTab === "inventory" && <button className="primary-button" onClick={() => setEditing(blankStrain)}><Plus size={18} /> Add Strain</button>}
          </div>
          {activeTab === "orders" ? (
            <OrderTable orders={orders} onView={setViewOrder} onStatus={handleStatus} onDelete={handleDeleteOrder} />
          ) : (
            <InventoryTable inventory={inventory} onEdit={setEditing} onDelete={handleDeleteStrain} />
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
          </div>
          <h3>Products Ordered</h3>
          {viewOrder.items?.map(item => <p key={`${item.productId}-${item.name}`}>{item.name} x {item.quantity}</p>)}
        </Modal>
      )}

      {editing && (
        <Modal title={editing._id ? "Edit Strain" : "Add Strain"} onClose={() => setEditing(null)}>
          <form className="strain-form" onSubmit={saveStrain}>
            <label>Name <input name="name" defaultValue={editing.name} required /></label>
            <label>Type <select name="strainType" defaultValue={editing.strainType}><option>Indica</option><option>Sativa</option><option>Hybrid</option></select></label>
            <label>Price <input name="price" type="number" step="0.01" min="0" defaultValue={editing.price} required /></label>
            <label>THC <input name="thc" type="number" step="0.1" min="0" defaultValue={editing.thc} required /></label>
            <label>CBD <input name="cbd" type="number" step="0.1" min="0" defaultValue={editing.cbd} required /></label>
            <label>Potency <select name="potency" defaultValue={editing.potency}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label>Image URL <input name="image" defaultValue={editing.image} /></label>
            <label>Inventory Quantity <input name="quantity" type="number" min="0" defaultValue={editing.quantity} required /></label>
            <label className="wide">Description <textarea name="description" rows="4" defaultValue={editing.description} required /></label>
            <label className="checkbox-row"><input name="featured" type="checkbox" defaultChecked={editing.featured} /> Featured Toggle</label>
            <button className="primary-button wide" type="submit">Save Strain</button>
          </form>
        </Modal>
      )}
    </>
  );
}
