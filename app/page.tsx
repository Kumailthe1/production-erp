import LoginForm from "@/components/auth/login-form";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-white to-amber-50 p-4">
      <LoginForm />
    </div>
  );
}
