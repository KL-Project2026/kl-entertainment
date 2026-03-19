import { useState } from "react";
import { motion } from "framer-motion";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Input, Button, Card } from "@/components/ui";
import { Lock, Mail, Globe } from "lucide-react";
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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const setAuth = useAuthStore((state) => state.setAuth);

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

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Luxury Nightclub"
          className="w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07070A] via-[#07070A]/80 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      </div>

      <div className="absolute top-8 right-8 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
        <Globe className="w-4 h-4 text-primary" />
        <select
          className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
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
        <Card className="p-8 backdrop-blur-2xl bg-[#0a0a0f]/80 border-primary/20 shadow-2xl shadow-primary/5">
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6">
              <img
                src={`${import.meta.env.BASE_URL}images/logo.png`}
                alt="KL Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]"
              />
            </div>
            <h1 className="font-display text-3xl font-bold text-white mb-2 text-glow">KL Group</h1>
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
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

            <div className="pt-1">
              <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-2">
                {t("auth.demo_accounts")}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Super Admin", email: "admin@klproject.com", password: "Admin@123!" },
                  { label: "Club Noir KL Manager", email: "kl01@klproject.com", password: "Manager@123!" },
                  { label: "Velvet Lounge PJ Manager", email: "kl02@klproject.com", password: "Manager@123!" },
                ].map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword(account.password); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-primary/20 bg-primary/5 text-primary/70 hover:bg-primary/15 hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
                  >
                    {account.label}
                  </button>
                ))}
              </div>
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
