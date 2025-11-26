import React from 'react';
import { StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'Terms'>;

export default function TermsScreen({ navigation }: Props) {
  const { theme } = useTheme();

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.xl }]}>
          Terms and Conditions
        </ThemedText>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Last updated: November 2024
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          1. Agreement to Terms
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          By accessing or using Spline Payment ("the App"), operated by KNH Group, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the App.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          2. Description of Service
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          Spline Payment is a mobile application that enables users to split bills, manage shared expenses, and facilitate payments between friends. The App provides tools for creating split events, tracking payments, and managing a digital wallet for seamless transactions.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          3. User Accounts
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          To use the App, you must create an account by providing accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to use this service.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          4. Payment Services
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          The App integrates with BlinkPay for payment processing. By using payment features, you authorize KNH Group to initiate transactions on your behalf. All payment transactions are subject to the terms and conditions of our payment partners. Funds deposited into your Spline wallet are held in a business bank account, and in-app transfers between users are recorded as ledger entries until withdrawn.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          5. User Conduct
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          You agree not to use the App for any unlawful purpose, to harass or abuse other users, to attempt to gain unauthorized access to other accounts, to engage in fraudulent transactions, or to violate any applicable laws or regulations.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          6. Fees and Charges
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          While the basic features of the App are free to use, certain transactions may incur fees. Any applicable fees will be clearly disclosed before you complete a transaction. KNH Group reserves the right to modify fee structures with reasonable notice to users.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          7. Intellectual Property
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          All content, features, and functionality of the App, including but not limited to text, graphics, logos, and software, are the exclusive property of KNH Group and are protected by copyright, trademark, and other intellectual property laws.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          8. Limitation of Liability
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          To the maximum extent permitted by law, KNH Group shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App. Our total liability shall not exceed the amount of fees paid by you in the twelve months preceding the claim.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          9. Dispute Resolution
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          Any disputes arising from these terms or your use of the App shall be resolved through good faith negotiation. If a resolution cannot be reached, disputes shall be submitted to binding arbitration in New Zealand under the Arbitration Act 1996.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          10. Termination
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          KNH Group reserves the right to suspend or terminate your account at any time for violation of these terms or for any other reason at our sole discretion. Upon termination, you must cease all use of the App and any outstanding wallet balance will be returned to you within a reasonable timeframe.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          11. Changes to Terms
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We may update these Terms and Conditions from time to time. We will notify you of any material changes through the App or via email. Your continued use of the App after such changes constitutes acceptance of the updated terms.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          12. Contact Information
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          If you have any questions about these Terms and Conditions, please contact us at:
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.primary }]}>
          admin@spline.nz
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          KNH Group{'\n'}
          New Zealand
        </ThemedText>
      </ThemedView>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
});
