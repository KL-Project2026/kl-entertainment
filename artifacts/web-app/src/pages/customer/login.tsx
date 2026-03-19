import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Lock, Mail, Music2, Globe } from "lucide-react";
import { useCustomerAuthStore } from "@/lib/customer-auth";
import { getApiUrl } from "@/lib/api";

const LANGS = [
  { code: "en", label: "EN" }, { code: "zh", label: "中文" },
  { code: "ms", label: "BM" }, { code: "ja", label: "JP" },
  { code: "ko", label: "KR" }, { code: "th", label: "TH" },
];

export default function CustomerLogin() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const setCustomerAuth = useCustomerAuthStore((s) => s.setAuth);

  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("kl_lang", code);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/customer/auth/login" : "/api/customer/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, fullName, phone, languagePref: i18n.language };

      const res = await fetch(getApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: { token: string; id: string; fullName?: string; full_name?: string; email: string; languagePref?: string; language_pref?: string }; error?: string };

      if (!res.ok) {
        setError(json.error === "EMAIL_TAKEN" ? "Email is already registered." : t("auth.invalid_credentials"));
        return;
      }

      const customer = json.data!;
      setCustomerAuth(customer.token, {
        id: customer.id,
        fullName: customer.fullName ?? customer.full_name ?? "",
        email: customer.email,
        languagePref: customer.languagePref ?? customer.language_pref ?? "en",
      });
      if (customer.languagePref ?? customer.language_pref) {
        handleLang(customer.languagePref ?? customer.language_pref ?? "en");
      }
      setLocation("/customer");
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Globe className="w-4 h-4 text-amber-600" />
        <select value={i18n.language} onChange={(e) => handleLang(e.target.value)} className="bg-transparent text-sm text-amber-800 focus:outline-none cursor-pointer border border-amber-300 rounded px-2 py-1">
          {LANGS.map((l) => <option key={l.code} value={l.code} className="bg-white">{l.label}</option>)}
        </select>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Music2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">KL Entertainment</h1>
          <p className="text-gray-500 text-sm mt-1">{t("customer.portal")}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button onClick={() => setMode("login")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              {t("customer.login")}
            </button>
            <button onClick={() => setMode("register")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              {t("customer.register")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="relative">
                  <input type="text" placeholder={t("customer.name")} value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
                </div>
                <div className="relative">
                  <input type="tel" placeholder={t("customer.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <input type="email" placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <input type="password" placeholder={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold rounded-xl shadow-md hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-60 text-sm">
              {loading ? t("common.loading") : mode === "login" ? t("customer.login") : t("customer.register")}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Staff login? <a href="/" className="text-amber-600 hover:underline">Management Portal</a>
        </p>
      </motion.div>
    </div>
  );
}
