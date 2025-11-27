import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BLINKPAY_SANDBOX_URL = 'https://sandbox.debit.blinkpay.co.nz';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('BLINKPAY_CLIENT_ID');
  const clientSecret = Deno.env.get('BLINKPAY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('BlinkPay credentials not configured');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${BLINKPAY_SANDBOX_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token error:', error);
    throw new Error('Failed to get BlinkPay access token');
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

async function createPayment(
  consentId: string,
  amount: string,
  particulars: string,
  reference: string
) {
  const accessToken = await getAccessToken();

  const request = {
    consent_id: consentId,
    amount: {
      currency: 'NZD',
      total: amount
    },
    pcr: {
      particulars: particulars || 'Split Payment',
      code: 'PAYMENT',
      reference: reference || 'SPLIT'
    }
  };

  console.log('Creating payment with request:', JSON.stringify(request));

  const response = await fetch(`${BLINKPAY_SANDBOX_URL}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Payment creation error:', error);
    throw new Error(`Failed to create payment: ${error}`);
  }

  const data = await response.json();
  console.log('Payment created:', data);
  
  return {
    paymentId: data.payment_id,
    status: 'pending'
  };
}

async function getPaymentStatus(paymentId: string, maxWaitSeconds: number = 30) {
  const accessToken = await getAccessToken();
  
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${BLINKPAY_SANDBOX_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Get payment error:', error);
      throw new Error(`Failed to get payment status: ${error}`);
    }

    const data = await response.json();
    console.log('Payment status:', data.status);
    
    if (data.status === 'AcceptedSettlementCompleted' || 
        data.status === 'Completed' ||
        data.status === 'completed') {
      return {
        paymentId: paymentId,
        status: 'completed'
      };
    }
    
    if (data.status === 'Rejected' || 
        data.status === 'Failed' ||
        data.status === 'rejected' ||
        data.status === 'failed') {
      return {
        paymentId: paymentId,
        status: 'failed'
      };
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return {
    paymentId: paymentId,
    status: 'pending'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    console.log('BlinkPay Payment function called:', { method: req.method, action, path: url.pathname });

    if (req.method === 'POST' && action === 'create') {
      const { consentId, amount, particulars, reference } = await req.json();
      
      if (!consentId || !amount) {
        return new Response(
          JSON.stringify({ error: 'consentId and amount are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await createPayment(consentId, amount, particulars, reference);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && action === 'status') {
      const { paymentId, maxWaitSeconds } = await req.json();
      
      if (!paymentId) {
        return new Response(
          JSON.stringify({ error: 'paymentId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await getPaymentStatus(paymentId, maxWaitSeconds || 30);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use /create or /status' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('BlinkPay payment error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
