"use server";

import { getAdminClient } from "@/lib/supabase/admin";

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

  const admin = getAdminClient();
  if (admin) {
    const { error } = await admin.from("leads").insert({
      business_name: data.businessName,
      contact_name: data.contactName,
      email: data.email,
      phone: data.phone,
      address: data.address || null,
      business_type: data.businessType || null,
      monthly_volume: data.monthlyVolume || null,
      message: data.notes || null,
    });
    if (error) {
      // Don't lose the submission — log it so it's recoverable from Vercel logs.
      console.error("[olleik-apply] supabase insert failed:", error.message);
      console.log("[olleik-apply]", JSON.stringify(data));
    }
  } else {
    // Supabase not configured yet — log so submissions are captured meanwhile.
    console.log("[olleik-apply]", JSON.stringify(data));
  }

  return {
    status: "ok",
    message:
      "Thanks — your application is in. A rep will reach out within one business day.",
  };
}
