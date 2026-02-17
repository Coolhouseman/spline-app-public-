import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<any, 'SocialSignupBio'>;

export default function SocialSignupBioScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { clearSignupOverlay } = useAuth();
  const [bio, setBio] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  const params = route.params as { 
    userId: string;
    fullName?: string;
    provider: 'apple' | 'google';
    avatarUrl?: string;
  };

  const MAX_LENGTH = 200;

  useEffect(() => {
    clearSignupOverlay();
  }, []);

  const handleContinue = async () => {
    setLoading(true);

    try {
      if (bio.trim()) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            bio: bio.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', params.userId);

        if (updateError) {
          console.error('Error updating bio:', updateError);
          Alert.alert('Error', 'Failed to save your bio. Please try again.');
          setLoading(false);
          return;
        }
      }

      navigation.navigate('SocialSignupComplete', { 
        userId: params.userId,
        fullName: params.fullName,
        provider: params.provider,
        referralCode: referralCode.trim() || undefined,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save bio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFirstName = () => {
    if (params.fullName) {
      return params.fullName.split(' ')[0];
    }
    return '';
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          One More Thing
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
          {getFirstName() ? `${getFirstName()}, tell us about yourself` : 'Tell us about yourself'}
        </ThemedText>

        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
          Add a short bio so your friends know it's you
        </ThemedText>

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="Write a short bio..."
          placeholderTextColor={theme.textSecondary}
          value={bio}
          onChangeText={(text) => text.length <= MAX_LENGTH && setBio(text)}
          multiline
          numberOfLines={4}
          autoFocus
          textAlignVertical="top"
        />

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
          {bio.length}/{MAX_LENGTH} characters
        </ThemedText>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.xs }]}>
          Referral code (optional)
        </ThemedText>
        <TextInput
          style={[styles.referralInput, {
            backgroundColor: theme.surface,
            color: theme.text,
            borderColor: theme.border
          }]}
          placeholder="Enter referral code"
          placeholderTextColor={theme.textSecondary}
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed || loading ? 0.7 : 1
            }
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.light.buttonText} />
          ) : (
            <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
              {bio.trim() ? 'Continue' : 'Skip for now'}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    fontSize: 16,
  },
  referralInput: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
