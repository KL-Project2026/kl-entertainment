import { useState } from "react";
import { motion } from "framer-motion";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Input, Button, Card } from "@/components/ui";
import { Lock, Mail, Globe, Eye, EyeOff } from "lucide-react";
import { Link, useLocation } from "wouter";
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
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation]                 = useLocation();
  const { t, i18n }                     = useTranslation();
  const setAuth                         = useAuthStore((state) => state.setAuth);

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
              autoComplete="email"
              required
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-5 h-5" />}
                autoComplete="current-password"
                className="pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors p-1 cursor-pointer focus:outline-none focus-visible:text-gold"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex justify-end -mt-2">
              <Link
                href="/forgot-password"
                className="text-xs text-text-tertiary hover:text-gold transition-colors tracking-wide"
              >
                {t("auth.forgot_password")}
              </Link>
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
