import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import ActiveSessionsList from "@/components/pos/ActiveSessionsList";
import {
  useGetReservation,
  useListOrders,
  useCreateOrder,
  useAddOrderItem,
  useRemoveOrderItem,
  useApplyOrderDiscount,
  useFinalizeOrder,
  useCreateReceipt,
  useListBranches,
} from "@workspace/api-client-react";
import { getListOrdersQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Card, Button, Input, Badge } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowLeft,
  Printer,
  Tag,
  CreditCard,
  Banknote,
  Wallet,
} from "lucide-react";
import type { Order, OrderItem } from "@workspace/api-client-react";

const QUICK_ITEMS = [
  { description: "Room Charge", itemType: "room", unitPrice: 0 },
  { description: "Beer (1 bottle)", itemType: "beverage", unitPrice: 25 },
  { description: "Whiskey (1 bottle)", itemType: "beverage", unitPrice: 380 },
  { description: "Soft Drink", itemType: "beverage", unitPrice: 12 },
  { description: "Fruit Platter", itemType: "food", unitPrice: 88 },
  { description: "Chips & Snacks", itemType: "food", unitPrice: 35 },
  { description: "Red Bull", itemType: "beverage", unitPrice: 18 },
  { description: "Mineral Water", itemType: "beverage", unitPrice: 8 },
  { description: "Service Charge Override", itemType: "charge", unitPrice: 0 },
];

function PaymentModal({ order, onClose, onSuccess }: { order: Order; onClose: () => void; onSuccess: (receiptId: string) => void }) {
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [mode, setMode] = useState<"detailed" | "basic">("detailed");
  const createReceipt = useCreateReceipt();

  const handlePay = async () => {
    try {
      const res = await createReceipt.mutateAsync({
        id: order.id,
        data: { paymentMethod: method, paymentRef: ref || undefined, customerName: customerName || undefined, receiptMode: mode },
      });
      onSuccess(res.data.id);
    } catch (e) {
      console.error(e);
    }
  };

  const payMethods = [
    { id: "cash", label: "Cash", icon: Banknote },
    { id: "card", label: "Card", icon: CreditCard },
    { id: "ewallet", label: "E-Wallet", icon: Wallet },
    { id: "bank_transfer", label: "Transfer", icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md space-y-5 p-6">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-xl font-bold">Payment</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* Amount */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 text-center">
          <p className="text-sm text-muted-foreground mb-1">Total Amount Due</p>
          <p className="text-4xl font-display font-bold text-primary">MYR {Number(order.totalAmount).toFixed(2)}</p>
        </div>

        {/* Breakdown */}
        <div className="space-y-2 text-sm bg-black/30 rounded-xl p-4">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>MYR {Number(order.subtotal).toFixed(2)}</span></div>
          {Number(order.discountAmount) > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-MYR {Number(order.discountAmount).toFixed(2)}</span></div>}
          <div className="flex justify-between text-muted-foreground"><span>Service Charge (10%)</span><span>MYR {Number(order.serviceCharge).toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>SST (6%)</span><span>MYR {Number(order.sstAmount).toFixed(2)}</span></div>
          <div className="flex justify-between font-bold pt-2 border-t border-white/10 text-foreground"><span>Total</span><span>MYR {Number(order.totalAmount).toFixed(2)}</span></div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="text-sm font-medium text-muted-foreground block mb-2">Payment Method</label>
          <div className="grid grid-cols-2 gap-2">
            {payMethods.map(pm => (
              <button
                key={pm.id}
                onClick={() => setMethod(pm.id)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                  method === pm.id ? "border-primary bg-primary/10 text-primary" : "border-white/10 hover:border-white/20 text-muted-foreground"
                }`}
              >
                <pm.icon className="w-4 h-4" />
                {pm.label}
              </button>
            ))}
          </div>
        </div>

        {method !== "cash" && (
          <Input
            placeholder="Reference / Transaction No."
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        )}

        <Input
          placeholder="Customer Name (for receipt)"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />

        <div className="flex gap-2">
          <Button
            variant={mode === "detailed" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("detailed")}
            className="flex-1 gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> A4 Receipt
          </Button>
          <Button
            variant={mode === "basic" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("basic")}
            className="flex-1 gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> 80mm Thermal
          </Button>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handlePay} disabled={createReceipt.isPending} className="flex-1 gap-2">
            {createReceipt.isPending ? "Processing..." : <><CreditCard className="w-4 h-4" /> Pay & Print</>}
          </Button>
        </div>
        {createReceipt.isError && (
          <p className="text-sm text-destructive">Payment failed. Please try again.</p>
        )}
      </Card>
    </div>
  );
}

function OrderItemRow({ item, orderId, pending, onRemove }: {
  item: OrderItem;
  orderId: string;
  pending: boolean;
  onRemove: (itemId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.description}</p>
        <p className="text-xs text-muted-foreground">
          {item.quantity} × MYR {Number(item.unitPrice).toFixed(2)}
          {Number(item.discountPct) > 0 && <span className="text-emerald-400 ml-1">(-{item.discountPct}%)</span>}
        </p>
      </div>
      <span className="text-sm font-semibold text-primary whitespace-nowrap">MYR {Number(item.lineTotal).toFixed(2)}</span>
      <button
        onClick={() => onRemove(item.id)}
        disabled={pending}
        className="text-muted-foreground hover:text-destructive transition-colors ml-1"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddItemModal({ orderId, onClose, onAdded }: { orderId: string; onClose: () => void; onAdded: () => void }) {
  const [desc, setDesc] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [discountPct, setDiscountPct] = useState("0");
  const addItem = useAddOrderItem();

  const handleAdd = async () => {
    if (!desc || !unitPrice) return;
    await addItem.mutateAsync({
      id: orderId,
      data: {
        description: desc,
        unitPrice: parseFloat(unitPrice),
        quantity: parseFloat(qty) || 1,
        discountPct: parseFloat(discountPct) || 0,
      },
    });
    onAdded();
    onClose();
  };

  const selectQuick = (q: typeof QUICK_ITEMS[0]) => {
    setDesc(q.description);
    if (q.unitPrice > 0) setUnitPrice(String(q.unitPrice));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-lg font-bold">Add Order Item</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ITEMS.map(q => (
            <button
              key={q.description}
              onClick={() => selectQuick(q)}
              className="text-xs px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-primary/40 hover:text-primary transition-colors"
            >
              {q.description}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <Input placeholder="Description *" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Unit Price (MYR) *</label>
              <Input type="number" min={0} step={0.01} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
              <Input type="number" min={0.5} step={0.5} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Discount %</label>
              <Input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleAdd} disabled={addItem.isPending || !desc || !unitPrice} className="flex-1 gap-2">
            <Plus className="w-4 h-4" /> {addItem.isPending ? "Adding..." : "Add Item"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function POS() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const windowSearch = typeof window !== "undefined" ? window.location.search : "";
  const effectiveSearch = windowSearch || search;
  const params = new URLSearchParams(effectiveSearch);
  const reservationId = params.get("reservationId") || undefined;
  console.log("[POS] search:", JSON.stringify(search), "windowSearch:", JSON.stringify(windowSearch), "reservationId:", reservationId);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState(user?.branchId || "");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountPct, setDiscountPct] = useState("10");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const { data: branchesData } = useListBranches();
  const branches = branchesData?.data || [];

  const { data: reservationData } = useGetReservation(reservationId!, {
    query: { enabled: !!reservationId },
  });
  const reservation = reservationData?.data;

  const branchId = reservation?.branchId || selectedBranchId;

  const { data: ordersData, isLoading } = useListOrders({
    reservation_id: reservationId,
    branch_id: reservationId ? undefined : branchId,
  }, { query: { enabled: !!reservationId || !!branchId } });

  const orders = ordersData?.data || [];
  const activeOrder = orders.find(o => o.paymentStatus === "pending") || orders[0];

  const createOrder = useCreateOrder();
  const removeItem = useRemoveOrderItem();
  const applyDiscount = useApplyOrderDiscount();
  const finalizeOrder = useFinalizeOrder();

  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });

  const handleNewOrder = async () => {
    // Read latest search params directly from window at click time (most reliable)
    const clickTimeParams = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const clickTimeReservationId = clickTimeParams.get("reservationId") || undefined;
    const effectiveBranchId = branchId || undefined;
    const effectiveReservationId = clickTimeReservationId || reservationId;

    const canCreate = effectiveBranchId || effectiveReservationId;
    if (!canCreate) return;

    // Build URL with reservationId as query param for server-side fallback resolution
    let orderUrl = "/api/orders";
    if (effectiveReservationId) {
      orderUrl += `?reservationId=${encodeURIComponent(effectiveReservationId)}`;
    }

    // Use direct fetch so server always gets reservationId via URL params
    const token = useAuthStore.getState().token;
    const resp = await fetch(orderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        branchId: effectiveBranchId,
        reservationId: effectiveReservationId,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `HTTP ${resp.status}`);
    }
    invalidateOrders();
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!activeOrder) return;
    await removeItem.mutateAsync({ id: activeOrder.id, itemId });
    invalidateOrders();
  };

  const handleApplyDiscount = async () => {
    if (!activeOrder) return;
    await applyDiscount.mutateAsync({ id: activeOrder.id, data: { discount_pct: parseFloat(discountPct) } });
    invalidateOrders();
    setShowDiscount(false);
  };

  const handleFinalize = async () => {
    if (!activeOrder) return;
    await finalizeOrder.mutateAsync({ id: activeOrder.id });
    invalidateOrders();
  };

  const handlePaymentSuccess = (rId: string) => {
    setReceiptId(rId);
    setShowPayment(false);
    invalidateOrders();
    window.open(`/api/receipts/${rId}?mode=detailed`, "_blank");
  };

  const isPaid = activeOrder?.paymentStatus === "paid";
  const isFinalized = !!activeOrder?.finalizedAt;
  const items = activeOrder?.items || [];

  // NEW: If no reservationId — show Active Sessions List as POS entry point
  if (!reservationId) {
    return <ActiveSessionsList />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(reservationId ? "/reservations" : "/pos")}
          className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-display font-bold">Point of Sale</h2>
          {reservation && (
            <p className="text-sm text-muted-foreground">
              {reservation.reservationNo} · {reservation.customerName || "Walk-in"} · {reservation.roomName || "No room"}
            </p>
          )}
        </div>
      </div>

      {!reservationId && !activeOrder && (
        <Card className="p-4 flex gap-4 bg-black/40 border-white/5">
          <Select value={selectedBranchId || "__none__"} onValueChange={(v) => setSelectedBranchId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="w-56 bg-black/30">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select branch...</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items Panel */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}
            </div>
          ) : !activeOrder ? (
            <Card className="p-10 text-center bg-black/40">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No active order</p>
              <Button onClick={handleNewOrder} disabled={createOrder.isPending || (!branchId && !reservationId)} className="gap-2">
                <Plus className="w-4 h-4" /> {createOrder.isPending ? "Creating..." : "Open New Order"}
              </Button>
            </Card>
          ) : (
            <Card className="bg-black/40 border-white/5">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold">{activeOrder.orderNo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${
                    isPaid ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                    isFinalized ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                    "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}>{activeOrder.paymentStatus}</span>
                </div>
                {!isFinalized && !isPaid && (
                  <Button size="sm" onClick={() => setShowAddItem(true)} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </Button>
                )}
              </div>
              <div className="p-4">
                {items.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No items added yet</p>
                ) : (
                  <div>
                    {items.map((item) => (
                      <OrderItemRow
                        key={item.id}
                        item={item}
                        orderId={activeOrder.id}
                        pending={removeItem.isPending}
                        onRemove={handleRemoveItem}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Totals + Actions Panel */}
        <div className="space-y-4">
          {activeOrder && (
            <>
              <Card className="p-5 bg-black/40 border-white/5 space-y-3">
                <h4 className="font-display font-semibold text-sm text-primary uppercase tracking-wider">Order Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>MYR {Number(activeOrder.subtotal).toFixed(2)}</span>
                  </div>
                  {Number(activeOrder.discountAmount) > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount</span>
                      <span>-MYR {Number(activeOrder.discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Charge (10%)</span>
                    <span>MYR {Number(activeOrder.serviceCharge).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SST (6%)</span>
                    <span>MYR {Number(activeOrder.sstAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span className="text-primary">MYR {Number(activeOrder.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </Card>

              {!isFinalized && !isPaid && (
                <div className="space-y-3">
                  {showDiscount ? (
                    <Card className="p-4 bg-black/40 space-y-3">
                      <p className="text-sm font-medium">Apply Discount %</p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={handleApplyDiscount} disabled={applyDiscount.isPending}>
                          {applyDiscount.isPending ? "..." : "Apply"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowDiscount(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <Button variant="outline" onClick={() => setShowDiscount(true)} className="w-full gap-2">
                      <Tag className="w-4 h-4" /> Apply Discount
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleFinalize}
                    disabled={finalizeOrder.isPending || items.length === 0}
                    className="w-full gap-2"
                  >
                    {finalizeOrder.isPending ? "Finalizing..." : "Finalize Order"}
                  </Button>

                  <Button
                    onClick={() => setShowPayment(true)}
                    disabled={items.length === 0}
                    className="w-full gap-2"
                  >
                    <CreditCard className="w-4 h-4" /> Process Payment
                  </Button>
                </div>
              )}

              {isFinalized && !isPaid && (
                <Button onClick={() => setShowPayment(true)} className="w-full gap-2">
                  <CreditCard className="w-4 h-4" /> Process Payment
                </Button>
              )}

              {isPaid && (
                <div className="space-y-3">
                  <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-emerald-400 font-semibold">Payment Complete</p>
                    <p className="text-sm text-muted-foreground mt-1">via {activeOrder.paymentMethod?.replace("_"," ")}</p>
                  </div>
                  {receiptId && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/api/receipts/${receiptId}?mode=detailed`, "_blank")}
                      className="w-full gap-2"
                    >
                      <Printer className="w-4 h-4" /> Print Receipt
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddItem && activeOrder && (
        <AddItemModal
          orderId={activeOrder.id}
          onClose={() => setShowAddItem(false)}
          onAdded={invalidateOrders}
        />
      )}

      {showPayment && activeOrder && (
        <PaymentModal
          order={activeOrder}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
