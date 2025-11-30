import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrl = (): string => {
  const extra = Constants.expoConfig?.extra || {};
  
  if (extra.backendUrl) {
    return extra.backendUrl;
  }
  
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  
  if (Platform.OS === 'web') {
    return window.location.origin.replace(':5000', ':8082');
  }
  
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || Constants.expoConfig?.hostUri?.split(':')[0];
  if (replitDomain) {
    return `https://${replitDomain}`.replace(':8081', '');
  }
  
  return 'http://localhost:8082';
};

export interface SendOTPResult {
  success: boolean;
  status?: string;
  error?: string;
}

export interface VerifyOTPResult {
  success: boolean;
  valid: boolean;
  error?: string;
}

export class TwilioService {
  static async sendOTP(phoneNumber: string): Promise<SendOTPResult> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/twilio/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: errorData.error || 'Failed to send verification code' 
        };
      }

      const data = await response.json();
      return { 
        success: true, 
        status: data.status 
      };
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      return { 
        success: false, 
        error: error.message || 'Network error. Please try again.' 
      };
    }
  }

  static async verifyOTP(phoneNumber: string, code: string): Promise<VerifyOTPResult> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/twilio/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: formattedPhone, code }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          valid: false,
          error: errorData.error || 'Failed to verify code' 
        };
      }

      const data = await response.json();
      return { 
        success: true, 
        valid: data.valid === true,
        error: data.valid ? undefined : 'Invalid verification code'
      };
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return { 
        success: false, 
        valid: false,
        error: error.message || 'Network error. Please try again.' 
      };
    }
  }

  static formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
    
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('64')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.startsWith('0')) {
        cleaned = '+64' + cleaned.substring(1);
      } else {
        cleaned = '+64' + cleaned;
      }
    }
    
    return cleaned;
  }

  static isValidNZPhone(phone: string): boolean {
    const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
    const nzMobileRegex = /^(\+?64|0)?2\d{7,9}$/;
    const nzLandlineRegex = /^(\+?64|0)?[3-9]\d{6,8}$/;
    
    return nzMobileRegex.test(cleaned) || nzLandlineRegex.test(cleaned);
  }
}
