import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ivory p-5 text-ink">
      <div className="w-full max-w-md rounded-lg bg-paper p-7 shadow-subtle">
        <Link className="mb-8 inline-block text-xl font-black tracking-widest" href="/">
          THREAD
        </Link>
        <LoginForm admin googleEnabled={false} phoneEnabled={false} />
      </div>
    </main>
  );
}
