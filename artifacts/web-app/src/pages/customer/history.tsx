import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronLeft, CalendarDays, Search } from "lucide-react";
import { useCustomerAuthStore } from "@/lib/customer-auth";
import { getApiUrl } from "@/lib/api";

interface Booking {
  id: string;
  reservation_no: string;
  status: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  room_name: string;
  branch_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  tentative: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  checked_in: "bg-blue-100 text-blue-700",
  extended: "bg-purple-100 text-purple-700",
  checked_out: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
  no_show: "bg-red-100 text-red-500",
};

export default function CustomerHistory() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token } = useCustomerAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token) { setLocation("/customer/login"); return; }
    fetch(getApiUrl("/api/customer/bookings"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j: { data: Booking[] }) => setBookings(j.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, setLocation]);

  const filtered = bookings.filter((b) =>
    b.room_name.toLowerCase().includes(search.toLowerCase()) ||
    b.branch_name.toLowerCase().includes(search.toLowerCase()) ||
    b.reservation_no.toLowerCase().includes(search.toLowerCase())
  );

  const handleCancel = async (id: string) => {
    if (!token) return;
    if (!confirm("Cancel this booking?")) return;
    const res = await fetch(getApiUrl(`/api/customer/bookings/${id}/cancel`), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "cancelled" } : b));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 py-4 border-b border-amber-100">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => setLocation("/customer")} className="p-2 rounded-lg hover:bg-amber-50">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">{t("customer.my_bookings")}</p>
            <p className="text-xs text-gray-500">{bookings.length} total</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookings..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
        </div>

        {loading && <div className="text-center py-8 text-gray-400 text-sm">{t("common.loading")}</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="w-12 h-12 text-amber-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t("common.no_data")}</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((b, idx) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{b.room_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {t(`booking.status.${b.status}`) || b.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{b.branch_name}</p>
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(b.start_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.guest_count} guests · {b.reservation_no}</p>
                </div>
              </div>
              {["tentative", "confirmed"].includes(b.status) && (
                <button onClick={() => handleCancel(b.id)}
                  className="mt-3 text-xs text-red-500 hover:text-red-700 underline">
                  {t("booking.cancel")}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
