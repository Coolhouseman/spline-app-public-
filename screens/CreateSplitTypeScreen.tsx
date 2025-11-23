import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Friend } from '@/utils/storage';

type Props = NativeStackScreenProps<any, 'CreateSplitType'>;

export default function CreateSplitTypeScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { selectedFriends } = route.params as { selectedFriends: Friend[] };

  const handleSelectType = (type: 'equal' | 'specified') => {
    navigation.navigate('CreateSplitDetails', { selectedFriends, splitType: type });
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.h1, { color: theme.text, textAlign: 'center', marginBottom: Spacing.md }]}>
          Choose Split Type
        </ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing['2xl'] }]}>
          How would you like to split this bill?
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.typeCard,
            { 
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={() => handleSelectType('equal')}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Feather name="percent" size={32} color={theme.primary} />
          </View>
          <ThemedText style={[Typography.h2, { color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
            Equal Split
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            Divide the total amount equally among all participants
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.typeCard,
            { 
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={() => handleSelectType('specified')}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.secondary + '20' }]}>
            <Feather name="file-text" size={32} color={theme.secondary} />
          </View>
          <ThemedText style={[Typography.h2, { color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
            Specified
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            Upload a receipt and let each person pay their own share
          </ThemedText>
        </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  typeCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
