import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Loading login...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
