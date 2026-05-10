import { useState } from "react";
import { motion } from "framer-motion";
import { Input, Button, Card } from "@/components/ui";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "@/lib/api";

export default function ForgotPassword() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale: i18n.language }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "REQUEST_FAILED");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "REQUEST_FAILED");
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
              {t("auth.forgot_password_title")}
            </h1>
            <p className="text-text-tertiary text-xs tracking-wide mt-3 leading-relaxed">
              {t("auth.forgot_password_subtitle")}
            </p>
          </div>

          {submitted ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-gold mb-4" />
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t("auth.forgot_password_sent")}
                </p>
              </div>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-text-tertiary hover:text-gold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("auth.back_to_login")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                type="email"
                placeholder={t("auth.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-5 h-5" />}
                autoComplete="email"
                required
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-destructive text-sm text-center font-medium"
                >
                  {t("auth.invalid_credentials")}
                </motion.p>
              )}

              <Button type="submit" className="w-full mt-2 text-lg font-bold" size="lg" isLoading={loading}>
                {t("auth.forgot_password_submit")}
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
