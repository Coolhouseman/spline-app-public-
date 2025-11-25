import axios from 'axios';
import { 
  BlinkDebitClient,
  EnduringConsentRequest,
  CreateConsentResponse,
  PaymentRequest,
  PaymentResponse,
  Consent,
  Payment,
  AuthFlowDetailTypeEnum,
  AmountCurrencyEnum
} from 'blink-debit-api-client-node';

const BLINKPAY_SANDBOX_URL = 'https://sandbox.debit.blinkpay.co.nz';

export interface BlinkPayBankDetails {
  consent_id: string;
  bank_name: string;
  account_reference: string;
  status: 'active' | 'revoked' | 'expired';
  expires_at: string;
}

export class BlinkPayService {
  private static client: BlinkDebitClient | null = null;

  private static getClient(): BlinkDebitClient {
    if (!this.client) {
      const clientId = process.env.BLINKPAY_CLIENT_ID;
      const clientSecret = process.env.BLINKPAY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('BlinkPay credentials not configured');
      }

      this.client = new BlinkDebitClient(axios, {
        blinkpay: {
          debitUrl: BLINKPAY_SANDBOX_URL,
          clientId,
          clientSecret,
          timeout: 30000,
          retryEnabled: true
        }
      });
    }

    return this.client;
  }

  static async createEnduringConsent(
    redirectUri: string,
    maxAmountPerPeriod: string = '1000.00'
  ): Promise<{ consentId: string; redirectUri: string }> {
    const client = this.getClient();

    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(now.getFullYear() + 1);

    const request: EnduringConsentRequest = {
      flow: {
        detail: {
          type: AuthFlowDetailTypeEnum.Gateway,
          redirectUri
        }
      },
      maximumAmountPeriod: {
        currency: AmountCurrencyEnum.NZD,
        total: maxAmountPerPeriod
      },
      maximumAmountPayment: {
        currency: AmountCurrencyEnum.NZD,
        total: maxAmountPerPeriod
      },
      period: 'monthly' as any,
      fromTimestamp: now.toISOString() as any,
      expiryTimestamp: oneYearLater.toISOString() as any
    };

    console.log('Creating enduring consent with request:', JSON.stringify(request, null, 2));

    const response: CreateConsentResponse = await client.createEnduringConsent(request);

    console.log('Consent created:', { consentId: response.consentId, redirectUri: response.redirectUri });

    return {
      consentId: response.consentId || '',
      redirectUri: response.redirectUri || ''
    };
  }

  static async getEnduringConsent(consentId: string): Promise<BlinkPayBankDetails> {
    const client = this.getClient();
    const consent: Consent = await client.getEnduringConsent(consentId);

    const enduringDetail = consent.detail as any;

    return {
      consent_id: consentId,
      bank_name: 'Connected Bank',
      account_reference: '****',
      status: consent.status === 'Authorised' ? 'active' : 
              consent.status === 'Revoked' ? 'revoked' : 'expired',
      expires_at: enduringDetail?.expiryTimestamp || ''
    };
  }

  static async createPayment(
    consentId: string,
    amount: string,
    particulars: string,
    reference: string
  ): Promise<{ paymentId: string; status: string }> {
    const client = this.getClient();

    const request: PaymentRequest = {
      consentId,
      amount: {
        currency: AmountCurrencyEnum.NZD,
        total: amount
      },
      pcr: {
        particulars: particulars || 'Split Payment',
        code: 'PAYMENT',
        reference: reference || 'SPLIT'
      }
    };

    const response: PaymentResponse = await client.createPayment(request);

    return {
      paymentId: response.paymentId || '',
      status: 'pending'
    };
  }

  static async revokeEnduringConsent(consentId: string): Promise<void> {
    const client = this.getClient();
    await client.revokeEnduringConsent(consentId);
  }

  static async awaitSuccessfulPayment(
    paymentId: string,
    maxWaitSeconds: number = 30
  ): Promise<{ paymentId: string; status: string }> {
    const client = this.getClient();
    const payment: Payment = await client.awaitSuccessfulPayment(paymentId, maxWaitSeconds);
    return {
      paymentId: payment.paymentId,
      status: payment.status.toString()
    };
  }
}
