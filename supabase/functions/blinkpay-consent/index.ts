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
    console.error('Missing credentials - clientId exists:', !!clientId, 'clientSecret exists:', !!clientSecret);
    throw new Error('BlinkPay credentials not configured');
  }

  console.log('Attempting token request with clientId length:', clientId.length);

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
    console.error('Token error - status:', response.status, 'response:', error);
    throw new Error('Failed to get BlinkPay access token');
  }

  const data: TokenResponse = await response.json();
  console.log('Token obtained successfully');
  return data.access_token;
}

async function createEnduringConsent(redirectUri: string, maxAmount: string = '1000.00') {
  const accessToken = await getAccessToken();
  
  const now = new Date();
  const oneYearLater = new Date();
  oneYearLater.setFullYear(now.getFullYear() + 1);

  const request = {
    flow: {
      detail: {
        type: 'gateway',
        redirect_uri: redirectUri
      }
    },
    maximum_amount_period: {
      currency: 'NZD',
      total: maxAmount
    },
    period: 'monthly',
    from_timestamp: now.toISOString(),
    expiry_timestamp: oneYearLater.toISOString()
  };

  console.log('Creating consent with request:', JSON.stringify(request));

  const response = await fetch(`${BLINKPAY_SANDBOX_URL}/enduring-consents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Consent creation error:', error);
    throw new Error(`Failed to create consent: ${error}`);
  }

  const data = await response.json();
  console.log('Consent created:', data);
  
  return {
    consentId: data.consent_id,
    redirectUri: data.redirect_uri
  };
}

async function getEnduringConsent(consentId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${BLINKPAY_SANDBOX_URL}/enduring-consents/${consentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Get consent error:', error);
    throw new Error(`Failed to get consent: ${error}`);
  }

  const data = await response.json();
  console.log('Consent details from BlinkPay:', JSON.stringify(data));
  
  let bankName = 'Connected Bank';
  let accountReference = '****';
  
  if (data.detail?.bank_reference_id) {
    bankName = data.detail.bank_reference_id;
  }
  if (data.accounts && data.accounts.length > 0) {
    const account = data.accounts[0];
    bankName = account.bank?.bank_name || account.name || bankName;
    accountReference = account.account_number ? 
      `****${account.account_number.slice(-4)}` : 
      account.account_reference || accountReference;
  }
  
  return {
    consent_id: consentId,
    bank_name: bankName,
    account_reference: accountReference,
    status: data.status === 'Authorised' ? 'active' : 
            data.status === 'Revoked' ? 'revoked' : 
            data.status === 'Consumed' ? 'consumed' : 'expired',
    expires_at: data.expiry_timestamp || ''
  };
}

async function revokeEnduringConsent(consentId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${BLINKPAY_SANDBOX_URL}/enduring-consents/${consentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Revoke consent error:', error);
    throw new Error(`Failed to revoke consent: ${error}`);
  }

  return { success: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, redirectUri, maxAmount, consentId } = body;

    console.log('BlinkPay Consent function called:', { action });

    if (action === 'create') {
      if (!redirectUri) {
        return new Response(
          JSON.stringify({ error: 'redirectUri is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await createEnduringConsent(redirectUri, maxAmount);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'revoke') {
      if (!consentId) {
        return new Response(
          JSON.stringify({ error: 'consentId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await revokeEnduringConsent(consentId);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get') {
      if (!consentId) {
        return new Response(
          JSON.stringify({ error: 'consentId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await getEnduringConsent(consentId);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use create, get, or revoke' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('BlinkPay consent error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
