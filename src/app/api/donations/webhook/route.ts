import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-nowpayments-sig");
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    // Verify HMAC signature if the IPN secret is configured
    if (ipnSecret && signature) {
      const hmac = crypto.createHmac("sha512", ipnSecret);
      hmac.update(rawBody);
      const calculatedSignature = hmac.digest("hex");

      if (calculatedSignature !== signature) {
        console.error("Invalid NOWPayments webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 403 }
        );
      }
    } else if (!ipnSecret) {
      console.warn(
        "NOWPAYMENTS_IPN_SECRET is not set — skipping signature verification."
      );
    }

    const data = JSON.parse(rawBody);

    // Only process completed payments
    if (
      data.payment_status === "FINISHED" ||
      data.payment_status === "CONFIRMED"
    ) {
      const orderId = data.order_id; // This is the user_id we passed
      const invoiceId =
        data.invoice_id?.toString() || data.payment_id?.toString();

      if (!orderId) {
        console.error("Webhook payload missing order_id");
        return NextResponse.json(
          { error: "Missing order_id" },
          { status: 400 }
        );
      }

      // Initialize Supabase Admin client (bypasses RLS)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      if (!supabaseServiceKey) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Update the profile: grant OG Supporter badge
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_supporter: true,
          last_invoice_id: invoiceId,
        })
        .eq("id", orderId);

      if (error) {
        console.error("Failed to update profile:", error);
        return NextResponse.json(
          { error: "Database update failed" },
          { status: 500 }
        );
      }

      console.log(
        `Successfully granted OG Supporter badge to user ${orderId}`
      );
      return NextResponse.json({ success: true });
    }

    // Acknowledge other statuses (e.g., "WAITING", "CONFIRMING") without updating
    return NextResponse.json({
      received: true,
      status: data.payment_status,
    });
  } catch (error: any) {
    console.error("Donation webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
