import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Plus,
  Trash2,
  X,
  ArrowLeft,
  Printer,
  Tag,
  CreditCard,
  Banknote,
  Wallet,
  Users,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { Order, OrderItem } from "@workspace/api-client-react";

type CatalogItem = { id: string; name: string; unitPrice: number; sortOrder: number; isHostess?: boolean; };
type CatalogGroup = { id: string; name: string; sortOrder: number; menuCatName: string | null; items: CatalogItem[]; };
type HostessAssignment = {
  id: string;
  hostess_id: string;
  hostess_name: string;
  status: string;
  session_start: string;
  session_end: string | null;
  hourly_rate_guest: string;
  order_type: string;
};

function useHostessAssignments(reservationId?: string) {
  const token = useAuthStore.getState().token;
  return useQuery<HostessAssignment[]>({
    queryKey: ["hostess-assignments-reservation", reservationId ?? ""],
    queryFn: async () => {
      if (!reservationId) return [];
      const resp = await fetch(`/api/hostess-assignments/reservation/${reservationId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) return [];
      const data = await resp.json() as { data: HostessAssignment[] };
      return data.data ?? [];
    },
    enabled: !!reservationId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

function catMarker(menuCatName: string | null): string {
  if (!menuCatName) return "";
  const n = menuCatName.toLowerCase();
  if (n.includes("special")) return " **";
  if (n.includes("vip")) return " *";
  return "";
}

function usePosCatalog(branchId?: string) {
  const token = useAuthStore.getState().token;
  return useQuery<CatalogGroup[]>({
    queryKey: ["pos-catalog", branchId ?? ""],
    queryFn: async () => {
      const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
      const resp = await fetch(`/api/pos/catalog${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error("Failed to load catalog");
      const data = await resp.json() as { data: CatalogGroup[] };
      return data.data ?? [];
    },
    staleTime: 30_000,
  });
}

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

function AddItemModal({
  orderId,
  branchId,
  reservationId,
  onClose,
  onAdded,
  onHostessAssigned,
}: {
  orderId: string;
  branchId?: string;
  reservationId?: string;
  onClose: () => void;
  onAdded: () => void;
  onHostessAssigned?: (name: string) => void;
}) {
  const { data: categories = [], isLoading: menuLoading } = usePosCatalog(branchId);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [selectedHostess, setSelectedHostess] = useState<CatalogItem | null>(null);
  const [hostessLoading, setHostessLoading] = useState(false);
  const [hostessError, setHostessError] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [discountPct, setDiscountPct] = useState("0");
  const [mounted, setMounted] = useState(false);
  const addItem = useAddOrderItem();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (categories.length > 0 && !activeCatId) {
      setActiveCatId(categories[0].id);
    }
  }, [categories.length]);

  const activeGroup = categories.find(c => c.id === activeCatId) ?? null;
  const activeItems = activeGroup?.items ?? [];
  const isHostessCategory = activeItems.some(i => i.isHostess);

  useEffect(() => {
    if (!isHostessCategory) setSelectedHostess(null);
  }, [isHostessCategory]);

  const selectItem = (item: CatalogItem) => {
    if (item.isHostess) {
      setSelectedHostess(prev => prev?.id === item.id ? null : item);
      return;
    }
    setSelectedHostess(null);
    setDesc(item.name);
    setUnitPrice(item.unitPrice > 0 ? String(item.unitPrice) : "");
  };

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

  const handleAssignHostess = async () => {
    if (!selectedHostess || !reservationId) return;
    setHostessLoading(true);
    setHostessError(null);
    try {
      const token = useAuthStore.getState().token;
      const resp = await fetch("/api/hostess-assignments/add-on", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reservationId, hostessId: selectedHostess.id }),
      });
      // API returns { success: false, error: { code, message, detail } } on failure
      const body = await resp.json() as {
        success?: boolean;
        message?: string;
        error?: string | { code?: string; message?: string; detail?: unknown };
      };
      if (!resp.ok || !body.success) {
        const err = body.error;
        const rawCode =
          typeof err === "object" && err !== null ? err.code : undefined;
        const rawMsg =
          typeof err === "object" && err !== null
            ? err.message ?? err.code
            : typeof err === "string"
            ? err
            : body.message;
        // Human-readable error mapping
        const friendlyErrors: Record<string, string> = {
          ALREADY_ASSIGNED:       "This hostess is already assigned to another session right now.",
          NOT_SCHEDULED:          "This hostess has no scheduled shift at this time.",
          SHIFT_END_CONFLICT:     "Assignment would exceed the hostess's shift end time.",
          AGENCY_RESTRICTION:     "This hostess's agency is currently inactive.",
          RESERVATION_NOT_OCCUPIED: "The reservation is not active (must be checked-in).",
          HOSTESS_NOT_AVAILABLE:  "Hostess is not available at this time.",
        };
        const errMsg =
          (rawCode && friendlyErrors[rawCode]) ??
          (rawMsg && friendlyErrors[rawMsg as string]) ??
          rawMsg ??
          "Assignment failed — please try again.";
        setHostessError(errMsg);
        return;
      }
      onAdded();
      onHostessAssigned?.(selectedHostess.name);
      onClose();
    } catch {
      setHostessError("Network error — please retry");
    } finally {
      setHostessLoading(false);
    }
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
      <div className="w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-white/8 bg-[#0f0f14] shadow-2xl">

        {/* ── Header ── */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/8 shrink-0">
          <h3 className="font-display text-lg font-bold tracking-tight">Add Order Item</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">

          {/* Left — Category list */}
          <div className="w-48 shrink-0 border-r border-white/8 flex flex-col overflow-y-auto py-2 px-2 gap-0.5">
            {menuLoading ? (
              [1,2,3,4,5,6].map(i => <div key={i} className="h-9 rounded-lg bg-white/5 animate-pulse mx-1 mb-1" />)
            ) : categories.map(cat => {
              const marker = catMarker(cat.menuCatName);
              const isVip = marker === " *";
              const isSpecial = marker === " **";
              const isActive = activeCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCatId(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between gap-1 ${
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <span className="truncate">
                    {cat.name}
                    {marker && (
                      <span className={`ml-0.5 text-xs font-bold ${isSpecial ? "text-rose-400" : isVip ? "text-amber-400" : ""}`}>
                        {marker.trim()}
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] shrink-0 ${isActive ? "text-primary/70" : "text-white/25"}`}>
                    {cat.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right — Items + form */}
          <div className="flex-1 flex flex-col min-h-0">

            {/* Items area */}
            <div className="flex-1 overflow-y-auto p-4">
              {menuLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
                </div>
              ) : activeItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <ShoppingCart className="w-10 h-10 text-white/15 mb-3" />
                  <p className="text-muted-foreground text-sm">No items in this category</p>
                </div>
              ) : isHostessCategory ? (
                /* ── Hostess profile grid ── */
                <div>
                  {!reservationId && (
                    <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                      Hostess assignment requires an active reservation session.
                    </div>
                  )}
                  <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                    {activeItems.map(item => {
                      const isSelected = selectedHostess?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectItem(item)}
                          disabled={!reservationId}
                          className={`text-left p-4 rounded-xl border transition-all relative ${
                            isSelected
                              ? "bg-primary/15 border-primary/60 shadow-[0_0_0_1px_rgba(var(--primary),0.4)]"
                              : "bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                          }`}
                        >
                          {/* Avatar placeholder */}
                          <div className={`w-10 h-10 rounded-full mb-2.5 flex items-center justify-center text-base font-bold ${
                            isSelected ? "bg-primary/30 text-primary" : "bg-white/8 text-white/50"
                          }`}>
                            {item.name.charAt(0)}
                          </div>
                          <p className={`text-sm font-semibold leading-snug ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {item.name}
                          </p>
                          <p className={`text-xs mt-1 ${isSelected ? "text-primary/70" : "text-muted-foreground"}`}>
                            MYR {item.unitPrice.toFixed(0)}/hr
                          </p>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 10">
                                <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── Normal product grid ── */
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                  {activeItems.map(item => {
                    const isSelected = desc === item.name;
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectItem(item)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-primary/15 border-primary/50 shadow-[0_0_0_1px_rgba(var(--primary),0.3)]"
                            : "bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15"
                        }`}
                      >
                        <p className={`text-sm font-medium leading-snug ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {item.name}
                        </p>
                        <p className={`text-xs mt-1.5 ${isSelected ? "text-primary/70" : "text-muted-foreground"}`}>
                          {item.unitPrice > 0 ? `MYR ${item.unitPrice.toFixed(2)}` : "Price TBD"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom form — switches based on category */}
            {isHostessCategory ? (
              /* ── Hostess assign form ── */
              <div className="shrink-0 border-t border-white/8 px-4 py-4 bg-black/20">
                {selectedHostess ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20">
                      <div className="w-9 h-9 rounded-full bg-primary/25 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {selectedHostess.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{selectedHostess.name}</p>
                        <p className="text-xs text-muted-foreground">MYR {selectedHostess.unitPrice.toFixed(0)}/hr · Billed at session close</p>
                      </div>
                    </div>
                    {hostessError && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                        <span className="shrink-0 font-bold mt-0.5">!</span>
                        <span>{hostessError}</span>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
                      <Button
                        onClick={handleAssignHostess}
                        disabled={hostessLoading || !reservationId}
                        className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-black font-semibold"
                      >
                        <Plus className="w-4 h-4" />
                        {hostessLoading ? "Assigning..." : "Assign Hostess"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
                    <Button disabled className="flex-1 gap-2 opacity-50">
                      Select a hostess above
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Normal product form ── */
              <div className="shrink-0 border-t border-white/8 px-4 py-4 space-y-3 bg-black/20">
                <Input
                  placeholder="Description *"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Unit Price (MYR) *</label>
                    <Input type="number" min={0} step={0.01} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                    <Input type="number" min={0.5} step={0.5} value={qty} onChange={(e) => setQty(e.target.value)} className="bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Discount %</label>
                    <Input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className="bg-white/5 border-white/10" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
                  <Button onClick={handleAdd} disabled={addItem.isPending || !desc || !unitPrice} className="flex-1 gap-2">
                    <Plus className="w-4 h-4" /> {addItem.isPending ? "Adding..." : "Add Item"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [addingOrder, setAddingOrder] = useState(false);
  const [assignedToast, setAssignedToast] = useState<string | null>(null);

  const { data: branchesData } = useListBranches();
  const branches = branchesData?.data || [];

  const { data: hostessAssignments = [], refetch: refetchAssignments } = useHostessAssignments(reservationId);
  const activeAssignments = hostessAssignments.filter(a => a.status === "ACTIVE");

  const handleHostessAssigned = useCallback((name: string) => {
    setAssignedToast(name);
    refetchAssignments();
    setTimeout(() => setAssignedToast(null), 4000);
  }, [refetchAssignments]);

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
  // Reservation orders (ORD-...) go into tabs; hostess orders (HOS-...) are tracked separately
  const reservationOrders = orders.filter(o => !String(o.orderNo ?? "").startsWith("HOS-"));
  const activeOrder = reservationOrders.find(o => o.paymentStatus === "pending") || reservationOrders[0];

  // Auto-select: prefer pending reservation order, fall back to first reservation order
  useEffect(() => {
    if (reservationOrders.length === 0) return;
    setSelectedOrderId(prev => {
      if (prev && reservationOrders.find(o => o.id === prev)) return prev;
      return (reservationOrders.find(o => o.paymentStatus === "pending") || reservationOrders[0]).id;
    });
  }, [reservationOrders.map(o => o.id).join(",")]);

  const currentOrder = reservationOrders.find(o => o.id === selectedOrderId) || activeOrder;

  const createOrder = useCreateOrder();
  const removeItem = useRemoveOrderItem();
  const applyDiscount = useApplyOrderDiscount();
  const finalizeOrder = useFinalizeOrder();

  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });

  const handleNewOrder = async () => {
    const clickTimeParams = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const clickTimeReservationId = clickTimeParams.get("reservationId") || undefined;
    const effectiveBranchId = branchId || undefined;
    const effectiveReservationId = clickTimeReservationId || reservationId;

    const canCreate = effectiveBranchId || effectiveReservationId;
    if (!canCreate) return;
    setAddingOrder(true);
    try {
      let orderUrl = "/api/orders";
      if (effectiveReservationId) {
        orderUrl += `?reservationId=${encodeURIComponent(effectiveReservationId)}`;
      }

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
      const newOrderData = await resp.json() as { data?: { id?: string } };
      invalidateOrders();
      if (newOrderData?.data?.id) setSelectedOrderId(newOrderData.data.id);
    } finally {
      setAddingOrder(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!currentOrder) return;
    await removeItem.mutateAsync({ id: currentOrder.id, itemId });
    invalidateOrders();
  };

  const handleApplyDiscount = async () => {
    if (!currentOrder) return;
    await applyDiscount.mutateAsync({ id: currentOrder.id, data: { discount_pct: parseFloat(discountPct) } });
    invalidateOrders();
    setShowDiscount(false);
  };

  const handleFinalize = async () => {
    if (!currentOrder) return;
    await finalizeOrder.mutateAsync({ id: currentOrder.id });
    invalidateOrders();
  };

  const handlePaymentSuccess = (rId: string) => {
    setReceiptId(rId);
    setShowPayment(false);
    invalidateOrders();
    window.open(`/api/receipts/${rId}?mode=detailed`, "_blank");
  };

  const isPaid = currentOrder?.paymentStatus === "paid";
  const isFinalized = !!currentOrder?.finalizedAt;
  const items = currentOrder?.items || [];

  // NEW: If no reservationId — show Active Sessions List as POS entry point
  if (!reservationId) {
    return <ActiveSessionsList />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Success toast */}
      {assignedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-900/90 border border-emerald-500/40 text-emerald-300 shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span className="text-sm font-medium"><strong>{assignedToast}</strong> has been assigned successfully.</span>
          <button onClick={() => setAssignedToast(null)} className="text-emerald-500 hover:text-emerald-300 ml-1"><X className="w-4 h-4" /></button>
        </div>
      )}

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
          ) : !currentOrder ? (
            <Card className="p-10 text-center bg-black/40">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No active order</p>
              <Button onClick={handleNewOrder} disabled={addingOrder || (!branchId && !reservationId)} className="gap-2">
                <Plus className="w-4 h-4" /> {addingOrder ? "Creating..." : "Open New Order"}
              </Button>
            </Card>
          ) : (
            <>
              {/* Order tabs — only show reservation-type orders in tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {orders.filter(o => !String(o.orderNo ?? "").startsWith("HOS-")).map((o, idx) => {
                  const tabPaid = o.paymentStatus === "paid";
                  const tabFinalized = !!o.finalizedAt;
                  const isSelected = o.id === selectedOrderId;
                  return (
                    <button
                      key={o.id}
                      onClick={() => { setSelectedOrderId(o.id); setShowDiscount(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                        isSelected
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      }`}
                    >
                      <span>Order {idx + 1}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        tabPaid ? "bg-emerald-500/20 text-emerald-400"
                        : tabFinalized ? "bg-blue-500/20 text-blue-400"
                        : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {tabPaid ? "Paid" : tabFinalized ? "Finalized" : "Open"}
                      </span>
                    </button>
                  );
                })}
                {/* Add New Order button — only enabled when all existing orders are finalized/paid */}
                {reservationId && (() => {
                  const existingOpen = reservationOrders.find(o => o.paymentStatus === "pending" && !o.finalizedAt);
                  const blocked = !!existingOpen;
                  return (
                    <button
                      onClick={() => {
                        if (blocked) {
                          // Switch to the existing open order instead
                          setSelectedOrderId(existingOpen!.id);
                        } else {
                          handleNewOrder();
                        }
                      }}
                      disabled={addingOrder}
                      title={blocked ? "An open order already exists — using it" : "Add new order"}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                        blocked
                          ? "border-amber-500/30 text-amber-400/60 cursor-not-allowed opacity-60"
                          : "border-dashed border-white/20 text-muted-foreground hover:border-primary/40 hover:text-primary"
                      } disabled:opacity-40`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {addingOrder ? "Adding…" : "New Order"}
                    </button>
                  );
                })()}
              </div>

              <Card className="bg-black/40 border-white/5">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold">{currentOrder.orderNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${
                      isPaid ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                      isFinalized ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                      "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    }`}>{currentOrder.paymentStatus}</span>
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
                          orderId={currentOrder.id}
                          pending={removeItem.isPending}
                          onRemove={handleRemoveItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Totals + Actions Panel */}
        <div className="space-y-4">
          {/* Active Hostesses Panel — shown whenever reservation has assignments */}
          {reservationId && (
            <Card className="p-4 bg-black/40 border-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-pink-400" />
                <h4 className="font-display font-semibold text-sm text-pink-400 uppercase tracking-wider">
                  Assigned Hostesses
                </h4>
                {activeAssignments.length > 0 && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold">
                    {activeAssignments.length} active
                  </span>
                )}
              </div>
              {activeAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No hostesses assigned yet. Use Add Item → Hostess to assign.</p>
              ) : (
                <div className="space-y-2">
                  {activeAssignments.map(a => {
                    const since = new Date(a.session_start);
                    const sinceStr = since.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: true });
                    return (
                      <div key={a.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-pink-300">{a.hostess_name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{a.hostess_name}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Since {sinceStr} · MYR {Number(a.hourly_rate_guest).toFixed(0)}/hr
                          </p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/15 text-pink-400 font-semibold shrink-0">Active</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {currentOrder && (
            <>
              <Card className="p-5 bg-black/40 border-white/5 space-y-3">
                <h4 className="font-display font-semibold text-sm text-primary uppercase tracking-wider">Order Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>MYR {Number(currentOrder.subtotal).toFixed(2)}</span>
                  </div>
                  {Number(currentOrder.discountAmount) > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount</span>
                      <span>-MYR {Number(currentOrder.discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Charge (10%)</span>
                    <span>MYR {Number(currentOrder.serviceCharge).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SST (6%)</span>
                    <span>MYR {Number(currentOrder.sstAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span className="text-primary">MYR {Number(currentOrder.totalAmount).toFixed(2)}</span>
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
                    <p className="text-sm text-muted-foreground mt-1">via {currentOrder.paymentMethod?.replace("_"," ")}</p>
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

      {showAddItem && currentOrder && (
        <AddItemModal
          orderId={currentOrder.id}
          branchId={branchId || undefined}
          reservationId={reservationId}
          onClose={() => setShowAddItem(false)}
          onAdded={invalidateOrders}
          onHostessAssigned={handleHostessAssigned}
        />
      )}

      {showPayment && currentOrder && (
        <PaymentModal
          order={currentOrder}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
