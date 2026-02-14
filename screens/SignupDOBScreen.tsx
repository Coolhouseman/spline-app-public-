import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Platform, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'SignupDOB'>;

export default function SignupDOBScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [date, setDate] = useState(new Date(2000, 0, 1));
  const [dateText, setDateText] = useState('2000-01-01');
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const params = route.params as { firstName: string; lastName: string; email: string; password: string; phone: string; referralCode?: string };

  const formatDateForStorage = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleContinue = () => {
    navigation.navigate('SignupProfilePicture', {
      ...params,
      dateOfBirth: formatDateForStorage(date),
    });
  };

  const handleDateTextChange = (text: string) => {
    setDateText(text);
    const parsedDate = new Date(text);
    if (!isNaN(parsedDate.getTime())) {
      setDate(parsedDate);
    }
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Step 6 of 8
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.xl }]}>
          When's your birthday?
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
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
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
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowAndroidPicker(true)}
              >
                <ThemedText style={[Typography.body, { color: theme.text }]}>
                  {formatDateForStorage(date)}
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
                }
              }}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              textColor={theme.text}
            />
          )}
        </View>
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={handleContinue}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            Continue
          </ThemedText>
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
