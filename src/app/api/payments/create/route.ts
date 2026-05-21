import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      console.error('Missing NOWPAYMENTS_API_KEY environment variable');
      return NextResponse.json({ error: 'Payment gateway configuration error' }, { status: 500 });
    }

    const payload = {
      price_amount: 2,
      price_currency: 'usd',
      order_id: user_id, // Map the user ID to the order
      order_description: 'Omoggle Ranked Access',
      success_url: 'https://omoggle.games/lobby',
    };

    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('NOWPayments API Error:', errorData);
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: response.status });
    }

    const data = await response.json();
    
    // NOWPayments returns the URL in `invoice_url`
    return NextResponse.json({ invoice_url: data.invoice_url });
    
  } catch (error: any) {
    console.error('Payment create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
