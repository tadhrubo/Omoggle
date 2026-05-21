import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { user_id, amount } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount < 1) {
      return NextResponse.json(
        { error: "Minimum donation is $1 USD" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      console.error("Missing NOWPAYMENTS_API_KEY environment variable");
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 500 }
      );
    }

    const payload = {
      price_amount: parsedAmount,
      price_currency: "usd",
      pay_currency: "ltc",
      order_id: user_id,
      order_description: "Omoggle Server Donation",
      success_url: "https://omoggle.games/lobby",
    };

    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("NOWPayments API Error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({ invoice_url: data.invoice_url });
  } catch (error: any) {
    console.error("Donation create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
