import React from 'react';
import { StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const { theme } = useTheme();

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.xl }]}>
          Privacy Policy
        </ThemedText>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Last updated: November 2024
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          1. Introduction
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          KNH Group ("we", "us", or "our") operates Spline Payment (the "App"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our App. By using Spline Payment, you consent to the data practices described in this policy.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          2. Information We Collect
        </ThemedText>
        <ThemedText style={[styles.subTitle, { color: theme.text }]}>
          Personal Information
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          When you create an account, we collect your name, email address, phone number, date of birth, and profile picture. This information is necessary to provide our services and verify your identity.
        </ThemedText>
        <ThemedText style={[styles.subTitle, { color: theme.text }]}>
          Financial Information
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          To facilitate payments, we collect bank account information through our payment partner BlinkPay. We store transaction history, wallet balances, and payment preferences to provide our bill-splitting services.
        </ThemedText>
        <ThemedText style={[styles.subTitle, { color: theme.text }]}>
          Usage Data
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We automatically collect information about how you interact with the App, including device information, IP address, app usage patterns, and crash reports. This helps us improve our services.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          3. How We Use Your Information
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We use the collected information to provide and maintain the App's functionality, process transactions and manage your wallet, connect you with friends for bill splitting, send notifications about split requests and payments, improve and personalize your experience, comply with legal obligations and prevent fraud, and communicate important updates about our services.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          4. Information Sharing
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We may share your information with payment processors such as BlinkPay to facilitate transactions, other users as necessary for bill splitting such as your name and profile picture, service providers who assist in operating our App, and legal authorities when required by law or to protect our rights.
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We do not sell your personal information to third parties for marketing purposes.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          5. Data Security
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We implement industry-standard security measures to protect your information, including encryption of data in transit and at rest, secure authentication protocols, regular security audits and monitoring, and limited access to personal data by authorized personnel only.
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          However, no method of electronic transmission or storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          6. Data Retention
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We retain your personal information for as long as your account is active or as needed to provide services. We may retain certain information as required by law, to resolve disputes, or enforce our agreements. Transaction records may be kept for up to 7 years for legal and regulatory compliance.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          7. Your Rights
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          Depending on your location, you may have the right to access the personal information we hold about you, request correction of inaccurate information, request deletion of your information, object to or restrict certain processing activities, receive your data in a portable format, and withdraw consent where processing is based on consent.
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          To exercise these rights, please contact us at admin@spline.nz.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          8. Push Notifications
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          With your permission, we send push notifications about split requests, payment updates, and friend activity. You can manage notification preferences in your device settings at any time.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          9. Children's Privacy
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          The App is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we discover that we have collected information from a child, we will promptly delete it.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          10. International Data Transfers
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          Your information may be transferred to and processed in countries other than New Zealand. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          11. Changes to This Policy
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          We may update this Privacy Policy from time to time. We will notify you of significant changes through the App or via email. The "Last updated" date at the top of this policy indicates when it was last revised.
        </ThemedText>

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          12. Contact Us
        </ThemedText>
        <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
          If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:
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
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
});
