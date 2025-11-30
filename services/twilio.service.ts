import { supabase } from './supabase';

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
      
      const { data, error } = await supabase.functions.invoke('twilio-sms', {
        body: { 
          action: 'send',
          phoneNumber: formattedPhone 
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to send verification code' 
        };
      }

      if (!data.success) {
        return { 
          success: false, 
          error: data.error || 'Failed to send verification code' 
        };
      }

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
      
      const { data, error } = await supabase.functions.invoke('twilio-sms', {
        body: { 
          action: 'verify',
          phoneNumber: formattedPhone,
          code 
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        return { 
          success: false, 
          valid: false,
          error: error.message || 'Failed to verify code' 
        };
      }

      if (!data.success) {
        return { 
          success: false, 
          valid: false,
          error: data.error || 'Failed to verify code' 
        };
      }

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
