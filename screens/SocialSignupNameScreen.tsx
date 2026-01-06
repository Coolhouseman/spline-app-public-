import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<any, 'SocialSignupName'>;

export default function SocialSignupNameScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { clearSignupOverlay } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const params = route.params as { 
    userId: string;
    email?: string;
    provider: 'apple' | 'google';
    needsPhone?: boolean;
    needsDOB?: boolean;
    existingPhone?: string;
  };

  // Clear the loading overlay once this screen mounts (navigation is complete)
  useEffect(() => {
    clearSignupOverlay();
  }, []);

  if (!params?.userId) {
    return (
      <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.content}>
          <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
            Something went wrong
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            We could not complete your sign-in. Please try again.
          </ThemedText>
        </ThemedView>
      </ScreenKeyboardAwareScrollView>
    );
  }

  const isValidName = () => {
    return firstName.trim().length >= 1 && lastName.trim().length >= 1;
  };

  const handleContinue = async () => {
    if (!isValidName()) {
      setError('Please enter your first and last name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.userId);

      if (updateError) {
        setError('Failed to save your name. Please try again.');
        return;
      }

      if (params.needsPhone) {
        navigation.navigate('SocialSignupPhone', { 
          userId: params.userId,
          email: params.email,
          fullName: fullName,
          provider: params.provider,
        });
      } else if (params.needsDOB) {
        navigation.navigate('SocialSignupDOB', { 
          userId: params.userId,
          fullName: fullName,
          provider: params.provider,
          phone: params.existingPhone,
        });
      } else {
        navigation.navigate('SocialSignupComplete', { 
          userId: params.userId,
          fullName: fullName,
          provider: params.provider
        });
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Complete Your Profile
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
          What's your name?
        </ThemedText>

        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
          This will be displayed to your friends when splitting bills
        </ThemedText>

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: error ? Colors.light.danger : theme.border 
          }]}
          placeholder="First name"
          placeholderTextColor={theme.textSecondary}
          value={firstName}
          onChangeText={(text) => {
            setFirstName(text);
            if (error) setError('');
          }}
          autoCapitalize="words"
          autoFocus
        />

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: error ? Colors.light.danger : theme.border 
          }]}
          placeholder="Last name"
          placeholderTextColor={theme.textSecondary}
          value={lastName}
          onChangeText={(text) => {
            setLastName(text);
            if (error) setError('');
          }}
          autoCapitalize="words"
        />

        {error ? (
          <ThemedText style={[Typography.caption, { color: Colors.light.danger, marginTop: Spacing.sm }]}>
            {error}
          </ThemedText>
        ) : null}
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed || loading ? 0.7 : (isValidName() ? 1 : 0.4)
            }
          ]}
          onPress={handleContinue}
          disabled={!isValidName() || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.light.buttonText} />
          ) : (
            <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
              Continue
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
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
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
