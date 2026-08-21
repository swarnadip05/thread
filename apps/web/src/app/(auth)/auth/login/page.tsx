import { LoginForm } from "@/components/auth/login-form";
export default function LoginPage() {
  return (
    <LoginForm
      googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
      phoneEnabled={process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true"}
    />
  );
}
