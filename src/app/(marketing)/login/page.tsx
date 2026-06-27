import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Customer login — Olleik Foods",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
