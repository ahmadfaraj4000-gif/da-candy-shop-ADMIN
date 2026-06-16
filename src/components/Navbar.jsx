import { LogOut, Package, ShoppingBag } from "lucide-react";

export default function Navbar({ activeTab, onTabChange, onLogout }) {
  return (
    <header className="admin-nav">
      <div className="admin-brand"><span>DCS</span><strong>Da Candy Shop Admin</strong></div>
      <nav className="tab-list">
        <button className={activeTab === "orders" ? "active" : ""} onClick={() => onTabChange("orders")}>
          <ShoppingBag size={18} /> Orders
        </button>
        <button className={activeTab === "inventory" ? "active" : ""} onClick={() => onTabChange("inventory")}>
          <Package size={18} /> Inventory
        </button>
      </nav>
      <button className="icon-button" onClick={onLogout} title="Log out"><LogOut size={18} /></button>
    </header>
  );
}
