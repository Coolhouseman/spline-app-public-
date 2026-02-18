import { supabase } from './supabase';
import { resolveBackendOrigin } from '@/utils/backend';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

const SERVER_URL = resolveBackendOrigin();
const DEVICE_SIGNATURE_KEY = '@spline_device_signature';

export class ReferralsService {
  private static async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json')) {
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Server returned invalid JSON. Please try again.');
      }
    }

    return {
      error: `Unexpected server response from ${SERVER_URL} (HTTP ${response.status}).`,
      raw: text,
    };
  }

  private static async getAuthToken(): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Authentication required. Please log in again.');
    }
    return accessToken;
  }

  private static async getDeviceSignature(): Promise<string> {
    const existing = await AsyncStorage.getItem(DEVICE_SIGNATURE_KEY);
    if (existing) return existing;

    const randomPart = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const rawSignature = [
      Platform.OS,
      Device.brand || 'unknown_brand',
      Device.modelName || 'unknown_model',
      Device.osName || 'unknown_os',
      randomPart,
    ].join('|');

    await AsyncStorage.setItem(DEVICE_SIGNATURE_KEY, rawSignature);
    return rawSignature;
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

    const result = await this.parseResponse(response);
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send referral invite');
    }
  }

  static async registerOnSignup(referralCode?: string): Promise<void> {
    if (!referralCode?.trim()) return;
    try {
      const accessToken = await this.getAuthToken();
      const deviceSignature = await this.getDeviceSignature();
      await fetch(`${SERVER_URL}/api/referrals/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Device-Signature': deviceSignature,
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
      const deviceSignature = await this.getDeviceSignature();
      await fetch(`${SERVER_URL}/api/referrals/complete-card-bind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Device-Signature': deviceSignature,
        },
      });
    } catch (error) {
      console.log('[Referrals] Card-bind completion skipped:', error);
    }
  }
}
