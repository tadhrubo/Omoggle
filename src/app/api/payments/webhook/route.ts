import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // We need the raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-nowpayments-sig');
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (ipnSecret && signature) {
      // Verify HMAC signature if the secret is configured
      const hmac = crypto.createHmac('sha512', ipnSecret);
      hmac.update(rawBody);
      const calculatedSignature = hmac.digest('hex');

      if (calculatedSignature !== signature) {
        console.error('Invalid NOWPayments signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    } else if (!ipnSecret) {
      console.warn('NOWPAYMENTS_IPN_SECRET is not set. Skipping signature verification (Not recommended for production).');
    }

    const data = JSON.parse(rawBody);

    // Verify payment status
    if (data.payment_status === 'FINISHED' || data.payment_status === 'CONFIRMED') {
      const orderId = data.order_id; // This is the user_id we passed
      const invoiceId = data.invoice_id?.toString() || data.payment_id?.toString();

      if (!orderId) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
      }

      // Initialize Supabase Admin client to bypass RLS
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      if (!supabaseServiceKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
        return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Update the user's profile to unlock premium access
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          is_premium: true,
          last_invoice_id: invoiceId,
        })
        .eq('id', orderId);

      if (error) {
        console.error('Failed to update profile to premium:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      console.log(`Successfully upgraded user ${orderId} to premium.`);
      return NextResponse.json({ success: true });
    }

    // Acknowledge other statuses without updating
    return NextResponse.json({ received: true, status: data.payment_status });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
