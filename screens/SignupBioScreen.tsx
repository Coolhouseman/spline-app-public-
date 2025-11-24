import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { generateUniqueId } from '@/utils/storage';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'SignupBio'>;

export default function SignupBioScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { signup } = useAuth();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const params = route.params as { 
    firstName: string; 
    lastName: string; 
    email: string; 
    password: string; 
    phone: string; 
    dateOfBirth: string;
    profilePicture?: string;
  };

  const MAX_LENGTH = 200;

  const handleComplete = async () => {
    setLoading(true);
    try {
      const uniqueId = generateUniqueId();
      const fullName = `${params.firstName} ${params.lastName}`.trim();
      
      await signup({
        name: fullName,
        email: params.email,
        password: params.password,
        phone: params.phone,
        dateOfBirth: params.dateOfBirth,
        bio: bio.trim(),
        uniqueId: uniqueId,
      });
      
      navigation.navigate('SignupComplete', { uniqueId });
    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert('Signup Failed', error.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Step 8 of 8
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.xl }]}>
          Tell us about yourself
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
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed ? 0.7 : (loading ? 0.4 : 1)
            }
          ]}
          onPress={handleComplete}
          disabled={loading}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            {loading ? 'Creating account...' : 'Complete Signup'}
          </ThemedText>
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
