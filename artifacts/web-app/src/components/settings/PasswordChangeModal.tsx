import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

type Strength = "very-weak" | "weak" | "medium" | "strong" | "very-strong";

function getStrength(pwd: string): { level: Strength; label: string; color: string; width: string } {
  if (pwd.length < 8) return { level: "very-weak", label: "매우 약함", color: "bg-red-500", width: "w-1/5" };
  let score = 1;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const map: Record<number, { level: Strength; label: string; color: string; width: string }> = {
    1: { level: "weak",       label: "약함",    color: "bg-orange-400", width: "w-2/5" },
    2: { level: "medium",     label: "보통",    color: "bg-yellow-400", width: "w-3/5" },
    3: { level: "strong",     label: "강함",    color: "bg-blue-500",   width: "w-4/5" },
    4: { level: "very-strong",label: "매우 강함",color: "bg-green-500",  width: "w-full" },
  };
  return map[score] ?? map[1];
}

export default function PasswordChangeModal({ open, onClose, userId, userName }: Props) {
  const { token } = useAuthStore();
  const [newPwd, setNewPwd]     = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showNew, setShowNew]   = useState(false);
  const [showCfm, setShowCfm]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const mismatch = confirm.length > 0 && newPwd !== confirm;
  const strength = getStrength(newPwd);

  const handleSubmit = async () => {
    setError(null);
    if (newPwd.length < 8) { setError("비밀번호는 최소 8자 이상이어야 합니다."); return; }
    if (newPwd !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }

    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/password`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPwd, confirm_password: confirm }),
      });
      const data = await res.json() as { success: boolean; error?: string; message?: string };
      if (!data.success) { setError(data.message ?? data.error ?? "변경 실패"); return; }
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); setNewPwd(""); setConfirm(""); }, 1500);
    } catch {
      setError("서버 연결 오류");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setNewPwd(""); setConfirm(""); setError(null); setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔐 패스워드 변경
            <span className="text-sm font-normal text-muted-foreground">— {userName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Audit warning banner */}
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>변경 내용은 <strong>감사 로그</strong>에 기록됩니다.</span>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">새 패스워드</Label>
            <div className="relative">
              <Input
                id="new-pwd"
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                className="pr-9"
                placeholder="최소 8자"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Strength bar */}
            {newPwd.length > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-300", strength.color, strength.width)} />
                </div>
                <p className="text-xs text-muted-foreground">강도: <span className="font-medium">{strength.label}</span></p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">패스워드 확인</Label>
            <div className="relative">
              <Input
                id="confirm-pwd"
                type={showCfm ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={cn("pr-9", mismatch && "border-red-500 focus-visible:ring-red-500")}
                placeholder="패스워드 재입력"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowCfm(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCfm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mismatch && <p className="text-xs text-red-500">패스워드가 일치하지 않습니다.</p>}
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-center font-medium">
              ✅ 비밀번호가 성공적으로 변경되었습니다.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving || mismatch || newPwd.length < 8}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 변경 중…</> : "패스워드 변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
