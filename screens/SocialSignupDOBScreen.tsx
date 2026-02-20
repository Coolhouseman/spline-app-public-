import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, TextInput, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<any, 'SocialSignupDOB'>;

export default function SocialSignupDOBScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { clearSignupOverlay } = useAuth();
  const [date, setDate] = useState(new Date(2000, 0, 1));
  const [dateText, setDateText] = useState('2000-01-01');
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const params = route.params as { 
    userId: string;
    fullName?: string;
    provider: 'apple' | 'google';
    phone: string;
    referralCode?: string;
  };

  // Clear the loading overlay once this screen mounts (navigation is complete)
  useEffect(() => {
    clearSignupOverlay();
  }, []);

  const isValidAge = () => {
    const today = new Date();
    const birthDate = date;
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 16;
  };

  const handleContinue = async () => {
    if (!isValidAge()) {
      setError('You must be at least 16 years old to use Spline');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          date_of_birth: formattedDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.userId);

      if (updateError) {
        setError('Failed to save your birthday. Please try again.');
        return;
      }

      navigation.navigate('SocialSignupProfilePicture', { 
        userId: params.userId,
        fullName: params.fullName,
        provider: params.provider,
        referralCode: params.referralCode,
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateTextChange = (text: string) => {
    setDateText(text);
    setError('');
    const parsedDate = new Date(text);
    if (!isNaN(parsedDate.getTime())) {
      setDate(parsedDate);
    }
  };

  const getFirstName = () => {
    if (params.fullName) {
      return params.fullName.split(' ')[0];
    }
    return '';
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Almost Done
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
          {getFirstName() ? `${getFirstName()}, when's your birthday?` : "When's your birthday?"}
        </ThemedText>

        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
          You must be at least 16 years old to use Spline
        </ThemedText>

        <View style={styles.pickerContainer}>
          {Platform.OS === 'web' ? (
            <View style={styles.webInputContainer}>
              <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
                Date of Birth (YYYY-MM-DD)
              </ThemedText>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: error ? Colors.light.danger : theme.border,
                  }
                ]}
                value={dateText}
                onChangeText={handleDateTextChange}
                placeholder="2000-01-01"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>
          ) : Platform.OS === 'android' ? (
            <>
              <Pressable
                style={[
                  styles.androidDateButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: error ? Colors.light.danger : theme.border,
                  },
                ]}
                onPress={() => setShowAndroidPicker(true)}
              >
                <ThemedText style={[Typography.body, { color: theme.text }]}>
                  {`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
                    date.getDate()
                  ).padStart(2, '0')}`}
                </ThemedText>
              </Pressable>
              {showAndroidPicker ? (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    setShowAndroidPicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setDate(selectedDate);
                      setError('');
                    }
                  }}
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                />
              ) : null}
            </>
          ) : (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setDate(selectedDate);
                  setError('');
                }
              }}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              textColor={theme.text}
            />
          )}
        </View>

        {error ? (
          <ThemedText style={[Typography.caption, { color: Colors.light.danger, marginTop: Spacing.md, textAlign: 'center' }]}>
            {error}
          </ThemedText>
        ) : null}
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed || loading ? 0.7 : 1 }
          ]}
          onPress={handleContinue}
          disabled={loading}
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
    </ScreenScrollView>
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
  pickerContainer: {
    alignItems: 'center',
  },
  webInputContainer: {
    width: '100%',
  },
  androidDateButton: {
    width: '100%',
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  webInput: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
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
