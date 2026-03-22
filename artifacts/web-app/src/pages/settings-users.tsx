import UserManagement from "@/components/settings/UserManagement";
import { useAuthStore } from "@/lib/auth";
import { Redirect } from "wouter";

export default function SettingsUsers() {
  const { user } = useAuthStore();

  if (!user || user.role !== "super_admin") {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <UserManagement />
    </div>
  );
}
