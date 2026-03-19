import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Music2, CalendarDays, Plus, User, LogOut, ChevronRight, Clock } from "lucide-react";
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

export default function CustomerDashboard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { customer, token, logout } = useCustomerAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLocation("/customer/login"); return; }
    fetch(getApiUrl("/api/customer/bookings"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j: { data: Booking[] }) => setBookings(j.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, setLocation]);

  const upcoming = bookings.filter((b) => ["tentative", "confirmed", "checked_in"].includes(b.status));
  const past = bookings.filter((b) => ["checked_out", "cancelled", "no_show"].includes(b.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-amber-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("customer.portal")}</p>
            <p className="text-sm font-semibold text-gray-900">{customer?.fullName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLocation("/customer/profile")} className="p-2 rounded-lg hover:bg-amber-50 text-gray-500">
            <User className="w-5 h-5" />
          </button>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-red-50 text-red-400">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setLocation("/customer/booking")}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-amber-200"
        >
          <div>
            <p className="font-bold text-lg">{t("customer.new_booking")}</p>
            <p className="text-amber-100 text-sm mt-0.5">Reserve your room now</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Plus className="w-7 h-7" />
          </div>
        </motion.button>

        {upcoming.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Upcoming
            </h2>
            <div className="space-y-3">
              {upcoming.map((b) => (
                <motion.div key={b.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  onClick={() => setLocation(`/customer/history`)}
                  className="bg-white rounded-xl p-4 shadow-sm border border-amber-100 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{b.room_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{b.branch_name}</p>
                      <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(b.start_time).toLocaleDateString()} · {new Date(b.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t(`booking.status.${b.status}`) || b.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="text-center py-8 text-gray-400 text-sm">{t("common.loading")}</div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="w-12 h-12 text-amber-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t("common.no_data")}</p>
            <button onClick={() => setLocation("/customer/booking")} className="mt-4 px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors">
              {t("customer.new_booking")}
            </button>
          </div>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Past Bookings</h2>
            <div className="space-y-2">
              {past.slice(0, 3).map((b) => (
                <div key={b.id} className="bg-white/60 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{b.room_name}</p>
                      <p className="text-xs text-gray-400">{new Date(b.start_time).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {t(`booking.status.${b.status}`) || b.status}
                    </span>
                  </div>
                </div>
              ))}
              {past.length > 3 && (
                <button onClick={() => setLocation("/customer/history")} className="w-full text-center text-sm text-amber-600 hover:underline py-2">
                  View all {past.length} past bookings
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
