import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Music2, Users, MapPin, Calendar } from "lucide-react";
import { useCustomerAuthStore } from "@/lib/customer-auth";
import { getApiUrl } from "@/lib/api";

interface Branch { id: string; name: string; city: string; }
interface Room { id: string; name: string; capacity_min: number; capacity_max: number; room_type: string; hourly_rate: number; }

const STEPS = ["Branch & Date", "Choose Room", "Confirm"];

export default function CustomerBooking() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token } = useCustomerAuthStore();

  const [step, setStep] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const [startHour, setStartHour] = useState("20");
  const [duration, setDuration] = useState(2);
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setLocation("/customer/login"); return; }
    fetch(getApiUrl("/api/customer/branches"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j: { data: { items: Branch[] } }) => setBranches(j.data?.items ?? []))
      .catch(console.error);
  }, [token, setLocation]);

  useEffect(() => {
    if (!selectedBranch || !token) return;
    fetch(getApiUrl(`/api/customer/branches/${selectedBranch.id}/rooms`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j: { data: Room[] }) => setRooms(j.data ?? []))
      .catch(console.error);
  }, [selectedBranch, token]);

  const startTime = `${date}T${startHour.padStart(2, "0")}:00:00`;
  const endTime = new Date(new Date(startTime).getTime() + duration * 3600000).toISOString();

  const handleSubmit = async () => {
    if (!selectedBranch || !selectedRoom || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl("/api/customer/bookings"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ branchId: selectedBranch.id, roomId: selectedRoom.id, startTime, endTime, guestCount: guests, notes }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setLocation("/customer"), 2500);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{t("booking.confirm")}</h2>
          <p className="text-gray-500 text-sm mt-2">Your booking is submitted. Redirecting...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 py-4 border-b border-amber-100">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : setLocation("/customer")} className="p-2 rounded-lg hover:bg-amber-50">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-500">{t("customer.new_booking")}</p>
            <p className="text-sm font-semibold text-gray-900">{STEPS[step]}</p>
          </div>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= step ? "bg-amber-500" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-500" /> Select Branch</h3>
              <div className="grid gap-3">
                {branches.map((b) => (
                  <button key={b.id} onClick={() => setSelectedBranch(b)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedBranch?.id === b.id ? "border-amber-500 bg-amber-50" : "border-gray-200 bg-white hover:border-amber-300"}`}>
                    <p className="font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.city}</p>
                  </button>
                ))}
              </div>

              <h3 className="font-semibold text-gray-800 flex items-center gap-2 pt-2"><Calendar className="w-4 h-4 text-amber-500" /> Date & Time</h3>
              <input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start Hour</label>
                  <select value={startHour} onChange={(e) => setStartHour(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white">
                    {Array.from({ length: 16 }, (_, i) => i + 9).map((h) => (
                      <option key={h} value={String(h)}>{h.toString().padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Duration (hours)</label>
                  <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white">
                    {[1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h}h</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Users className="w-3 h-3" /> {t("booking.guests")}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setGuests(Math.max(1, guests - 1))} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 font-bold">-</button>
                  <span className="text-lg font-semibold text-gray-900 w-8 text-center">{guests}</span>
                  <button onClick={() => setGuests(Math.min(30, guests + 1))} className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold">+</button>
                </div>
              </div>

              <button onClick={() => { if (selectedBranch) setStep(1); }} disabled={!selectedBranch}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold rounded-xl shadow-md hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Music2 className="w-4 h-4 text-amber-500" /> Choose a Room</h3>
              {rooms.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">{t("common.loading")}</div>
              ) : (
                <div className="grid gap-3">
                  {rooms.map((r) => (
                    <button key={r.id} onClick={() => { setSelectedRoom(r); setStep(2); }}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedRoom?.id === r.id ? "border-amber-500 bg-amber-50" : "border-gray-200 bg-white hover:border-amber-300"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{r.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 capitalize">{r.room_type?.replace(/_/g, " ")}</p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {r.capacity_min}–{r.capacity_max} pax
                          </p>
                        </div>
                        {r.hourly_rate && (
                          <div className="text-right">
                            <p className="text-sm font-bold text-amber-600">MYR {Number(r.hourly_rate).toFixed(0)}</p>
                            <p className="text-xs text-gray-400">/hr</p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h3 className="font-semibold text-gray-800">Confirm Booking</h3>
              <div className="bg-white rounded-2xl p-5 border border-amber-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Branch</span>
                  <span className="font-medium text-gray-900">{selectedBranch?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("booking.room")}</span>
                  <span className="font-medium text-gray-900">{selectedRoom?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("booking.date")}</span>
                  <span className="font-medium text-gray-900">{new Date(startTime).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("booking.time")}</span>
                  <span className="font-medium text-gray-900">{new Date(startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {duration}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("booking.guests")}</span>
                  <span className="font-medium text-gray-900">{guests} pax</span>
                </div>
                {selectedRoom?.hourly_rate && (
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
                    <span className="text-gray-500">Est. Total</span>
                    <span className="font-bold text-amber-600">MYR {(Number(selectedRoom.hourly_rate) * duration).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Special Requests (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any special requests..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-none" />
              </div>

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl shadow-lg hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-60">
                {submitting ? t("common.loading") : t("booking.confirm")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
