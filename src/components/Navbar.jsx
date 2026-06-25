import { CreditCard, Gift, LogOut, Menu, Package, Percent, ShoppingBag, X } from "lucide-react";
import { useMemo, useState } from "react";

const tabs = [
  { id: "orders", label: "Orders", Icon: ShoppingBag },
  { id: "inventory", label: "Inventory", Icon: Package },
  { id: "payments", label: "QR Payments", Icon: CreditCard },
  { id: "discounts", label: "Discount Codes", Icon: Percent },
  { id: "prizeWheel", label: "Prize Wheel", Icon: Gift }
];

export default function Navbar({ activeTab, onTabChange, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLabel = useMemo(() => tabs.find(tab => tab.id === activeTab)?.label || "Menu", [activeTab]);

  function chooseTab(tab) {
    onTabChange(tab);
    setMenuOpen(false);
  }

  return (
    <header className={`admin-nav ${menuOpen ? "menu-open" : ""}`}>
      <div className="admin-brand">
        <img src={`${import.meta.env.BASE_URL}da-candy-shop-logo.png`} alt="Da Candy Shop" />
      </div>

      <button
        className="mobile-tab-menu-button"
        type="button"
        onClick={() => setMenuOpen(open => !open)}
        aria-expanded={menuOpen}
        aria-controls="admin-tab-menu"
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
        <span>{menuOpen ? "Close Menu" : activeLabel}</span>
      </button>

      <nav id="admin-tab-menu" className={`tab-list ${menuOpen ? "open" : ""}`}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} className={activeTab === id ? "active" : ""} onClick={() => chooseTab(id)}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      <button className="icon-button logout-button" onClick={onLogout} title="Log out"><LogOut size={18} /></button>
    </header>
  );
}
