import { useState } from "react";
import { motion } from "framer-motion";
import { Input, Button, Card } from "@/components/ui";
import { Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "@/lib/api";

function useQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const token = useQueryParam("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("auth.password_too_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.password_mismatch"));
      return;
    }
    if (!token) {
      setError(t("auth.reset_invalid_token"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (data.error === "INVALID_OR_EXPIRED_TOKEN") {
          setError(t("auth.reset_invalid_token"));
        } else if (data.error === "PASSWORD_TOO_SHORT") {
          setError(t("auth.password_too_short"));
        } else {
          setError(t("auth.reset_invalid_token"));
        }
        return;
      }
      setDone(true);
      setTimeout(() => setLocation("/login"), 2500);
    } catch {
      setError(t("auth.reset_invalid_token"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt=""
          className="w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-base via-surface-base/85 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 w-full max-w-md px-6"
      >
        <Card className="p-8">
          <div className="text-center mb-10">
            <div className="font-display text-5xl font-medium text-gold tracking-tight leading-none">KL</div>
            <div className="mx-auto mt-3 mb-3 h-px w-10 bg-border-default" />
            <h1 className="text-base font-medium text-text-primary tracking-[0.18em] uppercase">
              {t("auth.reset_password_title")}
            </h1>
            <p className="text-text-tertiary text-xs tracking-wide mt-3 leading-relaxed">
              {t("auth.reset_password_subtitle")}
            </p>
          </div>

          {done ? (
            <div className="flex flex-col items-center text-center py-4 space-y-4">
              <CheckCircle2 className="w-10 h-10 text-gold" />
              <p className="text-sm text-text-secondary leading-relaxed">{t("auth.reset_success")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.new_password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-5 h-5" />}
                  autoComplete="new-password"
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

              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.confirm_password")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                icon={<Lock className="w-5 h-5" />}
                autoComplete="new-password"
                required
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-destructive text-sm text-center font-medium"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" className="w-full mt-2 text-lg font-bold" size="lg" isLoading={loading}>
                {t("auth.reset_password_submit")}
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-xs text-text-tertiary hover:text-gold transition-colors mt-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t("auth.back_to_login")}
              </Link>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
