import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/services/supabase';
import { resolveBackendOrigin } from '@/utils/backend';

interface VoucherClaimModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  voucherType: string;
  voucherValue: string;
  levelRequired: number;
}

export function VoucherClaimModal({
  visible,
  onClose,
  userId,
  voucherType,
  voucherValue,
  levelRequired,
}: VoucherClaimModalProps) {
  const { theme: colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const REQUEST_TIMEOUT_MS = 10000;

  const getBackendOriginSafe = () => {
    try {
      return resolveBackendOrigin();
    } catch (resolveError) {
      console.warn('[VoucherClaimModal] Failed to resolve backend origin, using fallback:', resolveError);
      return 'https://www.spline.nz';
    }
  };

  const handleClaimVoucher = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('Please log in to claim your voucher');
        setLoading(false);
        return;
      }

      const backendUrl = getBackendOriginSafe();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(`${backendUrl}/api/gamification/claim-voucher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          voucherType,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to claim voucher');
        setLoading(false);
        return;
      }

      setClaimed(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Voucher claim error:', err);
      if (err?.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleClose = () => {
    setClaimed(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.content, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Feather name="gift" size={28} color={colors.primary} />
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {claimed ? (
            <View style={styles.claimedContainer}>
              <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
                <Feather name="check-circle" size={32} color={colors.success} />
              </View>
              <ThemedText style={[styles.title, { color: colors.text }]}>
                Voucher Claimed!
              </ThemedText>
              <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                Our team will be in touch within 1-2 business days to arrange your {voucherValue} dining experience.
              </ThemedText>
              <ThemedText style={[styles.note, { color: colors.textSecondary }]}>
                Please check your email for further instructions.
              </ThemedText>
              <Pressable
                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                onPress={handleClose}
              >
                <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Done</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <ThemedText style={[styles.title, { color: colors.text }]}>
                Claim Your {voucherValue}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.primary }]}>
                Level {levelRequired} Perk
              </ThemedText>
              
              <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                Congratulations on reaching Level {levelRequired}! You've unlocked a {voucherValue} as a reward for your loyalty.
              </ThemedText>

              <View style={[styles.infoBox, { backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="info" size={16} color={colors.textSecondary} />
                <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                  After claiming, our team will contact you to discuss your dining preferences and any dietary requirements.
                </ThemedText>
              </View>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: colors.danger + '15' }]}>
                  <Feather name="alert-circle" size={16} color={colors.danger} />
                  <ThemedText style={[styles.errorText, { color: colors.danger }]}>
                    {error}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.buttonContainer}>
                <Pressable
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={handleClose}
                  disabled={loading}
                >
                  <ThemedText style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                    Maybe Later
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.claimButton, 
                    { backgroundColor: loading ? colors.textSecondary : colors.primary }
                  ]}
                  onPress={handleClaimVoucher}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="gift" size={18} color="#fff" />
                      <ThemedText style={[styles.buttonText, { color: '#fff' }]}>
                        Claim Voucher
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  claimButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  claimedContainer: {
    alignItems: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  note: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  doneButton: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
});
