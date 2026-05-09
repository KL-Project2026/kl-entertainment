import { useState } from "react";
import { motion } from "framer-motion";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Input, Button, Card } from "@/components/ui";
import { Lock, Mail, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "th", label: "ภาษาไทย" },
];

type DemoAccount = { label: string; email: string; password: string };

const DEMO_GROUPS: { group: string; color: string; accounts: DemoAccount[] }[] = [
  {
    group: "Admin",
    color: "primary",
    accounts: [
      { label: "Super Admin",  email: "admin@klproject.com",    password: "Admin@123!" },
      { label: "Admin",        email: "admin2@klproject.com",   password: "KL@12345!" },
    ],
  },
  {
    group: "Management",
    color: "blue",
    accounts: [
      { label: "Investor",        email: "investor@klproject.com", password: "KL@12345!" },
      { label: "Branch Mgr (KL)", email: "kl01@klproject.com",     password: "KL@12345!" },
      { label: "Branch Mgr (PJ)", email: "kl02@klproject.com",     password: "KL@12345!" },
      { label: "Manager",         email: "manager@klproject.com",   password: "KL@12345!" },
    ],
  },
  {
    group: "Operations",
    color: "green",
    accounts: [
      { label: "Hostess",       email: "hostess@klproject.com", password: "KL@12345!" },
      { label: "Driver",        email: "driver@klproject.com",  password: "KL@12345!" },
      { label: "Kitchen",       email: "kitchen@klproject.com", password: "KL@12345!" },
      { label: "Hall Staff",    email: "hall@klproject.com",    password: "KL@12345!" },
      { label: "General Staff", email: "general@klproject.com", password: "KL@12345!" },
    ],
  },
];

const GROUP_STYLES: Record<string, { group: string; btn: string; dot: string }> = {
  primary: {
    group: "text-primary/50",
    btn: "border-primary/25 bg-primary/8 text-primary/80 hover:bg-primary/20 hover:border-primary/50 hover:text-primary",
    dot: "bg-primary",
  },
  blue: {
    group: "text-blue-400/50",
    btn: "border-blue-500/25 bg-blue-500/8 text-blue-300/80 hover:bg-blue-500/20 hover:border-blue-400/50 hover:text-blue-200",
    dot: "bg-blue-400",
  },
  green: {
    group: "text-emerald-400/50",
    btn: "border-emerald-500/25 bg-emerald-500/8 text-emerald-300/80 hover:bg-emerald-500/20 hover:border-emerald-400/50 hover:text-emerald-200",
    dot: "bg-emerald-400",
  },
};

export default function Login() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showDemo, setShowDemo]   = useState(false);
  const [, setLocation]           = useLocation();
  const { t, i18n }               = useTranslation();
  const setAuth                   = useAuthStore((state) => state.setAuth);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.accessToken, data.refreshToken, data.user);
        setLocation("/");
      },
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("kl_lang", code);
  };

  const fillAccount = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setShowDemo(false);
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Luxury Nightclub"
          className="w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-base via-surface-base/85 to-transparent" />
      </div>

      <div className="absolute top-8 right-8 z-20 flex items-center gap-2 bg-surface-1/80 backdrop-blur-md px-4 py-2 rounded-full border border-border-subtle">
        <Globe className="w-4 h-4 text-gold" />
        <select
          className="bg-transparent text-sm text-text-primary focus:outline-none cursor-pointer"
          value={i18n.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          {LANGS.map((l) => (
            <option key={l.code} className="bg-black text-white" value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 w-full max-w-md px-6"
      >
        <Card className="p-8">
          <div className="text-center mb-10">
            <div className="font-display text-5xl font-medium text-gold tracking-tight leading-none">
              KL
            </div>
            <div className="mx-auto mt-3 mb-3 h-px w-10 bg-border-default" />
            <h1 className="text-base font-medium text-text-primary tracking-[0.18em] uppercase">
              KL Group
            </h1>
            <p className="text-text-tertiary text-xs tracking-[0.24em] uppercase mt-1.5">
              {t("auth.management_portal")}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              type="email"
              placeholder={t("auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-5 h-5" />}
              required
            />
            <Input
              type="password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-5 h-5" />}
              required
            />

            {/* ── Demo Accounts ─────────────────────────────────── */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDemo((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground/50 uppercase tracking-widest hover:text-muted-foreground/80 transition-colors cursor-pointer select-none"
              >
                {t("auth.demo_accounts")}
                {showDemo
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>

              <motion.div
                initial={false}
                animate={{ height: showDemo ? "auto" : 0, opacity: showDemo ? 1 : 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  {DEMO_GROUPS.map(({ group, color, accounts }) => {
                    const s = GROUP_STYLES[color];
                    return (
                      <div key={group}>
                        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${s.group}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {group}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {accounts.map((a) => (
                            <button
                              key={a.email}
                              type="button"
                              onClick={() => fillAccount(a)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${s.btn}`}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>

            {loginMutation.isError && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: [-10, 10, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
                className="text-destructive text-sm text-center font-medium"
              >
                {t("auth.invalid_credentials")}
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full mt-4 text-lg font-bold"
              size="lg"
              isLoading={loginMutation.isPending}
            >
              {t("auth.sign_in")}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
