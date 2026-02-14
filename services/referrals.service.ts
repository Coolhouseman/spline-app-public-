import { supabase } from './supabase';
import { resolveBackendOrigin } from '@/utils/backend';

const SERVER_URL = resolveBackendOrigin();

export class ReferralsService {
  private static async getAuthToken(): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Authentication required. Please log in again.');
    }
    return accessToken;
  }

  static async sendInvite(inviteeEmail: string): Promise<void> {
    const accessToken = await this.getAuthToken();
    const response = await fetch(`${SERVER_URL}/api/referrals/send-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ inviteeEmail }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send referral invite');
    }
  }

  static async registerOnSignup(referralCode?: string): Promise<void> {
    if (!referralCode?.trim()) return;
    try {
      const accessToken = await this.getAuthToken();
      await fetch(`${SERVER_URL}/api/referrals/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ referralCode: referralCode.trim() }),
      });
    } catch (error) {
      console.log('[Referrals] Registration skipped:', error);
    }
  }

  static async completeCardBindingReward(): Promise<void> {
    try {
      const accessToken = await this.getAuthToken();
      await fetch(`${SERVER_URL}/api/referrals/complete-card-bind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.log('[Referrals] Card-bind completion skipped:', error);
    }
  }
}
