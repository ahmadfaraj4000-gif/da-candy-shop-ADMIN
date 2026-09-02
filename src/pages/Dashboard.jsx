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
import { optimizeInventoryImage } from "../lib/imageOptimizer.js";
import { useDebounce } from "../hooks/useDebounce.js";

const inventoryWeightOptions = [
  { key: "eighth", label: "3.5 grams", grams: 3.5 },
  { key: "quarter", label: "7 grams", grams: 7 },
  { key: "half", label: "14 grams", grams: 14 },
  { key: "ounce", label: "28 grams", grams: 28 }
];
const blankStrain = {
  name: "",
  strainType: "Hybrid",
  price: 0,
  onlinePrice: 0,
  grams: 3.5,
  weightPrices: {},
  onlineWeightPrices: {},
  potency: "Medium",
  description: "",
  image: "",
  available: true,
  featured: false
};
const convexApi = {
  orders: {
    listOrders: makeFunctionReference("orders:listOrders"),
    deleteOrder: makeFunctionReference("orders:deleteOrder"),
    deleteOrders: makeFunctionReference("orders:deleteOrders")
  },
  inventory: {
    listInventory: makeFunctionReference("inventory:listInventory"),
    generateImageUploadUrl: makeFunctionReference("inventory:generateImageUploadUrl"),
    upsertStrain: makeFunctionReference("inventory:upsertStrain"),
    deleteStrain: makeFunctionReference("inventory:deleteStrain")
  },
  payments: {
    listInStorePayments: makeFunctionReference("payments:listInStorePayments"),
    deleteInStorePayments: makeFunctionReference("payments:deleteInStorePayments")
  },
  discountCodes: {
    listDiscountCodes: makeFunctionReference("discountCodes:listDiscountCodes"),
    upsertDiscountCode: makeFunctionReference("discountCodes:upsertDiscountCode"),
    deleteDiscountCode: makeFunctionReference("discountCodes:deleteDiscountCode")
  },
  promotions: {
    listPromotions: makeFunctionReference("promotions:listPromotions"),
    upsertPromotion: makeFunctionReference("promotions:upsertPromotion"),
    setPromotionActive: makeFunctionReference("promotions:setPromotionActive"),
    deletePromotion: makeFunctionReference("promotions:deletePromotion")
  }
};

const blankDiscountCode = { code: "", type: "percent", value: 10, active: true, maxUses: undefined, expiresAt: "", note: "", minimumPurchase: undefined, maxDiscount: undefined };
const blankPromotion = { name: "", headline: "", description: "", inventoryIds: [], discountType: "percent", value: 10, active: true, startsAt: undefined, endsAt: undefined };

const defaultPrizeWheelPrizes = [
  { id: "five_percent", label: "5% Off Next Purchase", chance: 48, type: "percent", value: 5 },
  { id: "ten_percent", label: "10% Off Next Purchase", chance: 25, type: "percent", value: 10 },
  { id: "ten_off_fifty", label: "$10 Off a $50 Purchase", chance: 15, type: "fixed", value: 10, minimumPurchase: 50 },
  { id: "free_rolling_papers", label: "Free Rolling Papers", chance: 8, type: "free_rolling_papers" },
  { id: "twenty_percent", label: "20% Off Next Purchase", chance: 3, type: "percent", value: 20 },
  { id: "fifty_percent", label: "50% Off Your Next Purchase (Up to $30 Off)", chance: 1, type: "percent", value: 50, maxDiscount: 30 }
];

const prizeWheelRules = [
  "Spend $20 or more in a single transaction to earn 1 spin.",
  "One spin per qualifying purchase.",
  "Coupons expire 30 days after they are issued.",
  "Each coupon may only be redeemed once. After it is used, it becomes invalid.",
  "Only one coupon may be used per transaction.",
  "50% Off is limited to a maximum discount of $30.",
  "Coupons cannot be redeemed for cash, transferred, or combined with other promotions or discounts."
];

function makeWheelCode(prize) {
  const safePrefix = prize.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DCS-${safePrefix}-${randomPart}`;
}

function prizeNote(prize) {
  const details = [
    "Prize Wheel coupon. ONE USE ONLY.",
    "Expires 30 days after issue.",
    "Only one coupon per transaction.",
    "Cannot be redeemed for cash, transferred, or combined with other promotions or discounts."
  ];
  if (prize.minimumPurchase) details.push(`Minimum purchase: $${prize.minimumPurchase}.`);
  if (prize.maxDiscount) details.push(`Maximum discount: $${prize.maxDiscount}.`);
  return details.join(" ");
}

function discountPayloadForPrize(prize) {
  return {
    code: makeWheelCode(prize),
    type: prize.type,
    value: prize.value,
    active: true,
    maxUses: 1,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    note: prizeNote(prize),
    minimumPurchase: prize.minimumPurchase,
    maxDiscount: prize.maxDiscount
  };
}

function todayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeInputValue(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function choosePrize(prizes) {
  const totalChance = prizes.reduce((sum, prize) => sum + Number(prize.chance || 0), 0);
  let draw = Math.random() * totalChance;
  for (const prize of prizes) {
    draw -= Number(prize.chance || 0);
    if (draw <= 0) return prize;
  }
  return prizes[0];
}

function spinSegmentIndex(prizes, prizeId) {
  return Math.max(0, prizes.findIndex(prize => prize.id === prizeId));
}

function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

function animateWheelRotation(setRotation, from, to, duration, easing = progress => progress) {
  return new Promise(resolve => {
    const startedAt = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      setRotation(from + (to - from) * easing(progress));

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        setRotation(to);
        resolve();
      }
    }

    requestAnimationFrame(frame);
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

function optionalPriceFromForm(value) {
  if (String(value ?? "").trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function legacyWeightKey(grams) {
  const numericGrams = Number(grams ?? 3.5);
  return inventoryWeightOptions.find(option => Math.abs(option.grams - numericGrams) < .01)?.key || "eighth";
}

function inventoryPriceValue(strain, key, online = false) {
  const prices = online ? strain.onlineWeightPrices : strain.weightPrices;
  if (Number(prices?.[key]) > 0) return prices[key];
  const legacyKey = legacyWeightKey(strain.grams);
  if (key !== legacyKey) return "";
  return online ? Number(strain.onlinePrice ?? strain.price) || "" : Number(strain.price) || "";
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
  const [type, setType] = useState("");
  const [viewOrder, setViewOrder] = useState(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [wheelMode, setWheelMode] = useState("customer");
  const [prizeWheelPrizes, setPrizeWheelPrizes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dcsPrizeWheelPrizes") || "null");
      return Array.isArray(saved) && saved.length ? saved : defaultPrizeWheelPrizes;
    } catch (_) {
      return defaultPrizeWheelPrizes;
    }
  });
  const [wheelResult, setWheelResult] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const toast = useToast();
  const debouncedSearch = useDebounce(search);

  const orderArgs = { adminToken, search: debouncedSearch };
  const inventoryArgs = activeTab === "inventory"
    ? (type ? { search: debouncedSearch, strainType: type } : { search: debouncedSearch })
    : {};
  const orders = useQuery(convexApi.orders.listOrders, orderArgs);
  const inventory = useQuery(convexApi.inventory.listInventory, inventoryArgs);
  const qrPayments = useQuery(convexApi.payments.listInStorePayments, { adminToken });
  const discountCodes = useQuery(convexApi.discountCodes.listDiscountCodes, { adminToken });
  const promotions = useQuery(convexApi.promotions.listPromotions, { adminToken });
  const deleteOrder = useMutation(convexApi.orders.deleteOrder);
  const deleteOrders = useMutation(convexApi.orders.deleteOrders);
  const upsertStrain = useMutation(convexApi.inventory.upsertStrain);
  const generateImageUploadUrl = useMutation(convexApi.inventory.generateImageUploadUrl);
  const deleteStrain = useMutation(convexApi.inventory.deleteStrain);
  const upsertDiscountCode = useMutation(convexApi.discountCodes.upsertDiscountCode);
  const deleteDiscountCode = useMutation(convexApi.discountCodes.deleteDiscountCode);
  const upsertPromotion = useMutation(convexApi.promotions.upsertPromotion);
  const setPromotionActive = useMutation(convexApi.promotions.setPromotionActive);
  const deletePromotion = useMutation(convexApi.promotions.deletePromotion);
  const deleteInStorePayments = useMutation(convexApi.payments.deleteInStorePayments);

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

  function handleDeleteOrder(order) {
    setDeleteOrderTarget(order);
  }

  async function confirmDeleteOrder() {
    if (!deleteOrderTarget) return;
    await deleteOrder({ adminToken, id: deleteOrderTarget._id });
    setDeleteOrderTarget(null);
    setSelectedOrderIds(current => current.filter(id => id !== deleteOrderTarget._id));
    toast.push("Order deleted.");
  }

  function toggleSelectedOrder(id) {
    setSelectedOrderIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function toggleAllOrders() {
    const ids = (orders || []).map(order => order._id);
    setSelectedOrderIds(current => current.length === ids.length ? [] : ids);
  }

  async function deleteSelectedOrders() {
    if (!selectedOrderIds.length) return;
    await deleteOrders({ adminToken, ids: selectedOrderIds });
    setSelectedOrderIds([]);
    toast.push("Selected orders deleted.");
  }

  function toggleSelectedPayment(id) {
    setSelectedPaymentIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function toggleAllPayments() {
    const ids = (qrPayments || []).map(payment => payment._id);
    setSelectedPaymentIds(current => current.length === ids.length ? [] : ids);
  }

  async function deleteSelectedPayments() {
    if (!selectedPaymentIds.length) return;
    await deleteInStorePayments({ adminToken, ids: selectedPaymentIds });
    setSelectedPaymentIds([]);
    toast.push("Selected QR payment sessions deleted.");
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
      const weightPrices = {};
      inventoryWeightOptions.forEach(({ key }) => {
        const price = optionalPriceFromForm(form[`price_${key}`]);
        if (!price || price <= 0) throw new Error(`Add a price for ${inventoryWeightOptions.find(option => option.key === key)?.label}.`);
        weightPrices[key] = price;
      });
      const onlineWeightPrices = { ...weightPrices };
      const primaryWeight = inventoryWeightOptions[0];
      const pickupPrice = weightPrices[primaryWeight.key];
      const onlinePrice = pickupPrice;
      const grams = primaryWeight.grams;
      const imageFile = formData.get("imageFile");
      let imageStorageId = editing?.imageStorageId;
      if (imageFile?.size) {
        const optimizedFile = await optimizeInventoryImage(imageFile);
        const uploadUrl = await generateImageUploadUrl({ adminToken });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": optimizedFile.type },
          body: optimizedFile
        });
        if (!response.ok) throw new Error("Inventory image upload failed.");
        ({ storageId: imageStorageId } = await response.json());
      }
      const image = imageStorageId
        ? undefined
        : String(form.image || "").trim() || editing?.image || "";

      await upsertStrain({
        adminToken,
        id: editing?._id,
        name: form.name,
        strainType: form.strainType,
        description: form.description,
        image,
        imageStorageId,
        potency: form.potency,
        price: pickupPrice,
        onlinePrice,
        grams,
        weightPrices,
        onlineWeightPrices,
        available: form.available === "on",
        featured: form.featured === "on"
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
    const value = type === "free_1g" || type === "free_eighth" || type === "free_rolling_papers" ? undefined : numberFromForm(form.value);
    const maxUses = form.maxUses ? numberFromForm(form.maxUses) : undefined;
    const expiresAt = form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).getTime() : undefined;
    const minimumPurchase = form.minimumPurchase ? numberFromForm(form.minimumPurchase) : undefined;
    const maxDiscount = form.maxDiscount ? numberFromForm(form.maxDiscount) : undefined;

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
        note: form.note,
        minimumPurchase,
        maxDiscount
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

  async function savePromotion(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const form = Object.fromEntries(formData);
    const inventoryIds = [...new Set(formData.getAll("inventoryIds").map(String))];
    const startsAt = form.startsAt ? new Date(form.startsAt).getTime() : undefined;
    const endsAt = form.endsAt ? new Date(form.endsAt).getTime() : undefined;

    try {
      await upsertPromotion({
        adminToken,
        id: editingPromotion?._id,
        name: String(form.name || "").trim(),
        headline: String(form.headline || "").trim(),
        description: String(form.description || "").trim(),
        inventoryIds,
        discountType: form.discountType,
        value: numberFromForm(form.value),
        active: form.active === "on",
        startsAt,
        endsAt
      });
      setEditingPromotion(null);
      toast.push(form.active === "on" ? "Promotion saved and published live." : "Promotion saved as a draft. It will not appear on the storefront.");
    } catch (error) {
      toast.push(error.message || "Promotion could not be saved.", "error");
    }
  }

  async function togglePromotion(promotion) {
    try {
      await setPromotionActive({ adminToken, id: promotion._id, active: !promotion.active });
      toast.push(promotion.active ? "Promotion stopped and returned to Draft." : "Promotion published live on the storefront.");
    } catch (error) {
      toast.push(error.message || "Promotion status could not be changed.", "error");
    }
  }

  async function handleDeletePromotion(id) {
    if (!confirm("Delete this promotion?")) return;
    await deletePromotion({ adminToken, id });
    toast.push("Promotion deleted.");
  }


  function updatePrizeChance(prizeId, nextChance) {
    setPrizeWheelPrizes(current => current.map(prize => (
      prize.id === prizeId ? { ...prize, chance: numberFromForm(nextChance) } : prize
    )));
  }

  function savePrizeOdds() {
    localStorage.setItem("dcsPrizeWheelPrizes", JSON.stringify(prizeWheelPrizes));
    toast.push("Prize wheel odds saved.");
  }

  function resetPrizeOdds() {
    setPrizeWheelPrizes(defaultPrizeWheelPrizes);
    localStorage.removeItem("dcsPrizeWheelPrizes");
    toast.push("Prize wheel odds reset.");
  }

  async function spinPrizeWheel() {
    if (wheelSpinning) return;
    const totalChance = prizeWheelPrizes.reduce((sum, prize) => sum + Number(prize.chance || 0), 0);
    if (totalChance <= 0) {
      toast.push("Prize wheel odds must add up above 0%.", "error");
      return;
    }

    const prize = choosePrize(prizeWheelPrizes);
    const payload = discountPayloadForPrize(prize);
    const landingRotations = [330, 270, 210, 150, 90, 30];
    const landingRotation = landingRotations[spinSegmentIndex(prizeWheelPrizes, prize.id)] ?? 330;
    const startRotation = wheelRotation;
    const desiredFastEnd = (landingRotation - 120 + 360) % 360;
    const naturalFastEnd = (startRotation + 2160) % 360;
    const fastAdjustment = (desiredFastEnd - naturalFastEnd + 360) % 360;
    const fastRotation = startRotation + 2160 + fastAdjustment;
    const finalRotation = fastRotation + 480;

    setWheelSpinning(true);
    setWheelResult(null);

    try {
      await animateWheelRotation(setWheelRotation, startRotation, fastRotation, 3000);
      await animateWheelRotation(setWheelRotation, fastRotation, finalRotation, 2000, easeOutCubic);
      await upsertDiscountCode({ adminToken, ...payload });
      setWheelResult({ prize, code: payload.code, expiresAt: payload.expiresAt });
      toast.push("Prize wheel code created under Discount Codes.");
    } catch (error) {
      toast.push(error.message || "Prize wheel code could not be created.", "error");
    } finally {
      setWheelSpinning(false);
    }
  }

  async function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setSearch("");
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
            <SearchBar value={search} onChange={setSearch} placeholder={activeTab === "orders" ? "Search orders" : activeTab === "payments" ? "Search QR payments" : activeTab === "discounts" ? "Search discount codes" : activeTab === "promotions" ? "Search promotions" : activeTab === "prizeWheel" ? "Prize wheel" : "Search strains"} />
            {activeTab === "orders" && (
              <BulkActions
                total={(orders || []).length}
                selected={selectedOrderIds.length}
                onSelectAll={toggleAllOrders}
                onDeleteSelected={deleteSelectedOrders}
              />
            )}
            {activeTab === "payments" && (
              <BulkActions
                total={(qrPayments || []).length}
                selected={selectedPaymentIds.length}
                onSelectAll={toggleAllPayments}
                onDeleteSelected={deleteSelectedPayments}
              />
            )}
            {activeTab === "inventory" && <Filters type={type} onTypeChange={setType} />}
            {activeTab === "inventory" && <button className="primary-button" onClick={() => setEditing(blankStrain)}><Plus size={18} /> Add Strain</button>}
            {activeTab === "promotions" && <button className="primary-button" onClick={() => setEditingPromotion(blankPromotion)}><Plus size={18} /> Add Promotion</button>}
            {activeTab === "discounts" && <button className="primary-button" onClick={() => setEditingDiscount(blankDiscountCode)}><Plus size={18} /> Add Code</button>}
          </div>
          {activeTab === "orders" && (
            <OrderTable orders={orders} selectedIds={selectedOrderIds} onToggle={toggleSelectedOrder} onView={setViewOrder} onDelete={handleDeleteOrder} />
          )}
          {activeTab === "payments" && (
            <QrPaymentTable payments={qrPayments} search={debouncedSearch} selectedIds={selectedPaymentIds} onToggle={toggleSelectedPayment} />
          )}
          {activeTab === "inventory" && (
            <InventoryTable inventory={inventory} onEdit={setEditing} onDelete={handleDeleteStrain} />
          )}
          {activeTab === "promotions" && (
            <PromotionTable promotions={promotions} search={debouncedSearch} onEdit={setEditingPromotion} onToggle={togglePromotion} onDelete={handleDeletePromotion} />
          )}
          {activeTab === "discounts" && (
            <DiscountCodeTable codes={discountCodes} onEdit={setEditingDiscount} onDelete={handleDeleteDiscountCode} />
          )}
          {activeTab === "prizeWheel" && (
            <PrizeWheelPanel
              prizes={prizeWheelPrizes}
              rules={prizeWheelRules}
              mode={wheelMode}
              onModeChange={setWheelMode}
              onChanceChange={updatePrizeChance}
              onResetOdds={resetPrizeOdds}
              onSaveOdds={savePrizeOdds}
              onSpin={spinPrizeWheel}
              spinning={wheelSpinning}
              rotation={wheelRotation}
              result={wheelResult}
            />
          )}
          {!["orders", "payments", "inventory", "promotions", "discounts", "prizeWheel"].includes(activeTab) && (
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
            <p><strong>Total</strong>{money(viewOrder.total)}</p>
            <p><strong>Promo</strong>{promoDetail(viewOrder)}</p>
          </div>
          <h3>Products Ordered</h3>
          {viewOrder.items?.map(item => <p key={`${item.productId}-${item.name}`}>{item.name} ({Number(item.grams ?? 3.5)}g) x {item.quantity}</p>)}
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
            <fieldset className="weight-price-editor wide">
              <legend>Prices by weight</legend>
              <p className="muted">Enter all four prices. The same verified prices are used on the menu, at pickup, and in Stripe.</p>
              <div className="weight-price-grid">
                {inventoryWeightOptions.map(option => (
                  <div className="weight-price-card" key={option.key}>
                    <strong>{option.label}</strong>
                    <label>Price <input name={`price_${option.key}`} type="number" step="0.01" min="0.01" defaultValue={inventoryPriceValue(editing, option.key)} placeholder="$0.00" required /></label>
                  </div>
                ))}
              </div>
            </fieldset>
            <label>Potency <select name="potency" defaultValue={editing.potency}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label>Image URL <input name="image" defaultValue={editing.image?.startsWith("data:") ? "" : editing.image} placeholder="Paste image URL or upload below" /></label>
            <label>Upload Image <input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleImageFileChange} /></label>
            {imagePreview && (
              <div className="image-preview wide">
                <img src={imageSrc(imagePreview)} alt={`${editing.name || "Strain"} preview`} />
              </div>
            )}
            <label className="checkbox-row"><input name="available" type="checkbox" defaultChecked={editing.available ?? Number(editing.quantity ?? 0) > 0} /> Available</label>
            <label className="checkbox-row"><input name="featured" type="checkbox" defaultChecked={editing.featured ?? false} /> Featured on homepage</label>
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
                <option value="free_rolling_papers">Free Rolling Papers</option>
              </select>
            </label>
            <label>Value <input name="value" type="number" step="0.01" min="0" defaultValue={editingDiscount.value ?? ""} /></label>
            <label>Minimum Purchase <input name="minimumPurchase" type="number" step="0.01" min="0" defaultValue={editingDiscount.minimumPurchase ?? ""} /></label>
            <label>Max Discount <input name="maxDiscount" type="number" step="0.01" min="0" defaultValue={editingDiscount.maxDiscount ?? ""} /></label>
            <label>Max Uses <input name="maxUses" type="number" min="1" defaultValue={editingDiscount.maxUses ?? ""} /></label>
            <label>Expires <input name="expiresAt" type="date" min={todayDateInput()} defaultValue={editingDiscount.expiresAt ? new Date(editingDiscount.expiresAt).toISOString().slice(0, 10) : todayDateInput()} /></label>
            <label className="checkbox-row"><input name="active" type="checkbox" defaultChecked={editingDiscount.active ?? true} /> Active</label>
            <label className="wide">Note <textarea name="note" rows="3" defaultValue={editingDiscount.note || ""} /></label>
            <button className="primary-button wide" type="submit">Save Code</button>
          </form>
        </Modal>
      )}

      {editingPromotion && (
        <Modal title={editingPromotion._id ? "Edit Promotion" : "Add Promotion"} onClose={() => setEditingPromotion(null)}>
          <form className="strain-form promotion-form" onSubmit={savePromotion}>
            <label>Internal Name <input name="name" defaultValue={editingPromotion.name} placeholder="Weekend flower special" required /></label>
            <fieldset className="promotion-flower-picker wide">
              <legend>Flowers</legend>
              <p className="muted">Choose between one and four flowers. The promotion applies automatically to every selected flower.</p>
              <div className="promotion-flower-grid">
                {(inventory || []).map(strain => {
                  const selectedIds = editingPromotion.inventoryIds?.length ? editingPromotion.inventoryIds : [editingPromotion.inventoryId].filter(Boolean);
                  return (
                    <label className="promotion-flower-option" key={strain._id}>
                      <input
                        name="inventoryIds"
                        type="checkbox"
                        value={strain._id}
                        defaultChecked={selectedIds.includes(strain._id)}
                        onChange={event => {
                          const checked = event.currentTarget.form.querySelectorAll('input[name="inventoryIds"]:checked');
                          if (checked.length > 4) {
                            event.currentTarget.checked = false;
                            toast.push("Choose up to four flowers.", "error");
                          }
                        }}
                      />
                      <span>{strain.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label>Discount Type
              <select name="discountType" defaultValue={editingPromotion.discountType}>
                <option value="percent">Percent Off</option>
                <option value="fixed">Dollar Off Each Item</option>
              </select>
            </label>
            <label>Discount Value <input name="value" type="number" step="0.01" min="0.01" max={editingPromotion.discountType === "percent" ? 100 : undefined} defaultValue={editingPromotion.value} required /></label>
            <label className="wide">Public Headline <input name="headline" defaultValue={editingPromotion.headline} placeholder="20% off Purple Planet" required /></label>
            <label className="wide">Public Description <textarea name="description" rows="3" defaultValue={editingPromotion.description} placeholder="Available for a limited time while supplies last." required /></label>
            <label>Starts <input name="startsAt" type="datetime-local" defaultValue={dateTimeInputValue(editingPromotion.startsAt)} /></label>
            <label>Ends <input name="endsAt" type="datetime-local" defaultValue={dateTimeInputValue(editingPromotion.endsAt)} /></label>
            <label className="promotion-live-control wide"><input name="active" type="checkbox" defaultChecked={editingPromotion.active ?? true} /><span><strong>Publish this promotion live</strong><small>Required for the visitor popup, flower-menu banner, and automatic checkout discount.</small></span></label>
            <p className="muted wide">Leaving this unchecked saves a private draft that customers cannot see. Publishing it automatically stops any other live promotion.</p>
            <button className="primary-button wide" type="submit">Save Promotion</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function BulkActions({ total, selected, onSelectAll, onDeleteSelected }) {
  return (
    <div className="bulk-actions">
      <button className="icon-button" type="button" onClick={onSelectAll} disabled={!total}>
        {selected && selected === total ? "Clear Selection" : "Select All"}
      </button>
      <button className="icon-button danger" type="button" onClick={onDeleteSelected} disabled={!selected}>
        Delete Selected{selected ? ` (${selected})` : ""}
      </button>
    </div>
  );
}

function promotionStatus(promotion) {
  const now = Date.now();
  if (!promotion.active) return { label: "Draft", className: "pending" };
  if (promotion.startsAt && promotion.startsAt > now) return { label: "Scheduled", className: "pending" };
  if (promotion.endsAt && promotion.endsAt < now) return { label: "Expired", className: "failed" };
  return { label: "Live", className: "paid" };
}

function PromotionTable({ promotions, search, onEdit, onToggle, onDelete }) {
  if (promotions === undefined) return <div className="state-card">Loading promotions...</div>;
  const query = search.trim().toLowerCase();
  const rows = query
    ? promotions.filter(promotion => [promotion.name, promotion.headline, promotion.description, promotion.flowerName].join(" ").toLowerCase().includes(query))
    : promotions;
  if (!rows.length) return <div className="state-card">No promotions match the current search.</div>;

  return (
    <div className="table-wrap responsive-admin-table promotion-table">
      <table>
        <thead>
          <tr><th>Promotion</th><th>Flowers</th><th>Discount</th><th>Status</th><th>Schedule</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(promotion => {
            const status = promotionStatus(promotion);
            const discount = promotion.discountType === "percent" ? `${promotion.value}% off` : `${money(promotion.value)} off each item`;
            const schedule = promotion.startsAt || promotion.endsAt
              ? `${promotion.startsAt ? new Date(promotion.startsAt).toLocaleString() : "Now"} – ${promotion.endsAt ? new Date(promotion.endsAt).toLocaleString() : "No end"}`
              : "No schedule";
            return (
              <tr key={promotion._id}>
                <td data-label="Promotion"><strong>{promotion.headline}</strong><br /><span className="muted">{promotion.name}</span></td>
                <td data-label="Flowers">{promotion.flowerName}</td>
                <td data-label="Discount">{discount}</td>
                <td data-label="Status"><span className={`payment-status ${status.className}`}>{status.label}</span></td>
                <td data-label="Schedule">{schedule}</td>
                <td className="actions" data-label="Actions">
                  <div className="action-group promotion-actions">
                    <button className="icon-button text-action" type="button" onClick={() => onEdit(promotion)}>Edit</button>
                    <button className="icon-button text-action" type="button" onClick={() => onToggle(promotion)}>{promotion.active ? "Stop" : "Publish Live"}</button>
                    <button className="icon-button text-action danger" type="button" onClick={() => onDelete(promotion._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function PrizeWheelPanel({ prizes, rules, mode, onModeChange, onChanceChange, onResetOdds, onSaveOdds, onSpin, spinning, rotation, result }) {
  const totalChance = prizes.reduce((sum, prize) => sum + Number(prize.chance || 0), 0);

  return (
    <div className="prize-wheel-panel">
      <div className="view-toggle prize-wheel-toggle">
        <button className={mode === "customer" ? "primary-button" : "icon-button"} type="button" onClick={() => onModeChange("customer")}>Customer View</button>
        <button className={mode === "admin" ? "primary-button" : "icon-button"} type="button" onClick={() => onModeChange("admin")}>Admin View</button>
      </div>

      {mode === "customer" ? (
        <div className="prize-wheel-customer">
          <div className="promo-spinner admin-prize-spinner" aria-live="polite">
            <div className="promo-spinner-copy">
              <strong>🎡 Prize Wheel</strong>
              <span>Spend $20 or more in a single transaction to earn 1 spin. Whatever the customer wins gets a one-use discount code.</span>
            </div>
            <div className="promo-wheel-wrap">
              <div className="promo-wheel" style={{ transform: `rotate(${rotation}deg)` }}>
                <svg viewBox="0 0 200 200" role="img" aria-label="Prize wheel with 5% Off, 10% Off, $10 Off $50, Free Rolling Papers, 20% Off, and 50% Off sections">
                  <path className="promo-slice promo-slice-good" d="M100 100 L100.00 8.00 A92 92 0 0 1 179.67 54.00 Z" />
                  <path className="promo-slice promo-slice-discount" d="M100 100 L179.67 54.00 A92 92 0 0 1 179.67 146.00 Z" />
                  <path className="promo-slice promo-slice-free" d="M100 100 L179.67 146.00 A92 92 0 0 1 100.00 192.00 Z" />
                  <path className="promo-slice promo-slice-fifty" d="M100 100 L100.00 192.00 A92 92 0 0 1 20.33 146.00 Z" />
                  <path className="promo-slice promo-slice-eighth" d="M100 100 L20.33 146.00 A92 92 0 0 1 20.33 54.00 Z" />
                  <path className="promo-slice promo-slice-hundred" d="M100 100 L20.33 54.00 A92 92 0 0 1 100.00 8.00 Z" />
                  <circle className="promo-wheel-rim" cx="100" cy="100" r="92" />
                  <circle className="promo-wheel-inner-ring" cx="100" cy="100" r="45" />
                  <circle className="promo-wheel-center" cx="100" cy="100" r="23" />
                  <text className="promo-wheel-label promo-wheel-label-good" x="129" y="47"><tspan x="129" dy="0">5%</tspan><tspan x="129" dy="10">Off</tspan><tspan x="129" dy="10">Next</tspan></text>
                  <text className="promo-wheel-label promo-wheel-label-discount" x="158" y="100"><tspan x="158" dy="0">10%</tspan><tspan x="158" dy="12">Off</tspan></text>
                  <text className="promo-wheel-label promo-wheel-label-free" x="129" y="150.2"><tspan x="129" dy="0">$10 Off</tspan><tspan x="129" dy="13">$50</tspan></text>
                  <text className="promo-wheel-label promo-wheel-label-fifty" x="71" y="150.2"><tspan x="71" dy="0">Free</tspan><tspan x="71" dy="12">Papers</tspan></text>
                  <text className="promo-wheel-label promo-wheel-label-eighth" x="42" y="100"><tspan x="42" dy="0">20%</tspan><tspan x="42" dy="12">Off</tspan></text>
                  <text className="promo-wheel-label promo-wheel-label-hundred" x="71" y="49.8"><tspan x="71" dy="0">50%</tspan><tspan x="71" dy="12">Max $30</tspan></text>
                </svg>
              </div>
              <span className="promo-pointer" aria-hidden="true"></span>
            </div>
            <button className="primary-button" type="button" onClick={onSpin} disabled={spinning}>{spinning ? "Spinning..." : "Spin"}</button>
            {result ? (
              <div className="prize-result">
                <p className="eyebrow">Customer Won</p>
                <h3>{result.prize.label}</h3>
                <p><strong>DISCOUNT CODE AVAILABLE FOR ONE USE ONLY:</strong> {result.code}</p>
                <p>Expires {new Date(result.expiresAt).toLocaleDateString()} and now reflects under the Discount Codes tab.</p>
              </div>
            ) : (
              <p className="promo-spin-message">Click spin to generate a one-use code under Discount Codes.</p>
            )}
          </div>

          <div className="mini-card prize-rules-card">
            <h3>Rules</h3>
            <ul>{rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
          </div>
        </div>
      ) : (
        <div className="prize-wheel-admin">
          <div className="panel-toolbar">
            <div>
              <h2>Prize Wheel Odds</h2>
              <p className="muted">Total odds: {totalChance}%</p>
            </div>
            <button className="primary-button" type="button" onClick={onSaveOdds}>Save Odds</button>
            <button className="icon-button" type="button" onClick={onResetOdds}>Reset Odds</button>
          </div>
          <div className="table-wrap responsive-admin-table prize-wheel-table">
            <table>
              <thead>
                <tr><th>Prize</th><th>Chance</th><th>Reward Settings</th></tr>
              </thead>
              <tbody>
                {prizes.map(prize => (
                  <tr key={prize.id}>
                    <td data-label="Prize">{prize.label}</td>
                    <td data-label="Chance"><input type="number" min="0" step="0.01" value={prize.chance} onChange={event => onChanceChange(prize.id, event.target.value)} /></td>
                    <td data-label="Reward Settings">{prize.minimumPurchase ? `$${prize.minimumPurchase} minimum. ` : ""}{prize.maxDiscount ? `$${prize.maxDiscount} max discount. ` : ""}One use only.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function QrPaymentTable({ payments, search, selectedIds = [], onToggle }) {
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
  const selected = new Set(selectedIds);

  return (
    <div className="table-wrap responsive-admin-table qr-payment-table">
      <table>
        <thead>
          <tr>
            <th className="select-cell">Select</th><th>Amount</th><th>Status</th><th>Name</th><th>Note</th><th>Stripe Session</th><th>Payment Intent</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(payment => (
            <tr key={payment._id}>
              <td className="select-cell" data-label="Select">
                <input
                  type="checkbox"
                  checked={selected.has(payment._id)}
                  onChange={() => onToggle(payment._id)}
                  aria-label={`Select QR payment ${payment._id}`}
                />
              </td>
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
  if (code.type === "percent") return `${code.value}% off${code.maxDiscount ? ` up to ${money(code.maxDiscount)}` : ""}`;
  if (code.type === "fixed") return `${money(code.value)} off${code.minimumPurchase ? ` $${code.minimumPurchase}+` : ""}`;
  if (code.type === "free_1g") return "Free 1g";
  if (code.type === "free_eighth") return "Free 1/8th";
  if (code.type === "free_rolling_papers") return "Free Rolling Papers";
  return code.type;
}

function DiscountCodeTable({ codes, onEdit, onDelete }) {
  if (codes === undefined) return <div className="state-card">Loading discount codes...</div>;
  if (!codes.length) return <div className="state-card">No discount codes yet.</div>;

  return (
    <div className="table-wrap discount-code-table">
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
              <td className="actions discount-code-actions">
                <div className="action-group discount-action-group">
                  <button className="icon-button discount-edit-button" type="button" onClick={() => onEdit(code)}>Edit</button>
                  <button className="icon-button danger discount-delete-button" type="button" onClick={() => onDelete(code._id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
