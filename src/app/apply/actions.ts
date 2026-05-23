"use server";

export type ApplyState = {
  status: "idle" | "ok" | "error";
  message: string;
};

export async function submitApplication(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const data = {
    businessName: String(formData.get("businessName") ?? "").trim(),
    contactName: String(formData.get("contactName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    businessType: String(formData.get("businessType") ?? "").trim(),
    monthlyVolume: String(formData.get("monthlyVolume") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  if (!data.businessName || !data.contactName || !data.email || !data.phone) {
    return {
      status: "error",
      message: "Please fill in business name, contact name, email, and phone.",
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  // TODO: once Supabase is provisioned, insert into `applications` table.
  // For now, log so submissions are captured in Vercel function logs.
  console.log("[olleik-apply]", JSON.stringify(data));

  return {
    status: "ok",
    message:
      "Thanks — your application is in. A rep will reach out within one business day.",
  };
}
