import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/theme';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';

interface FloatingActionButtonProps {
  navigation: any;
}

export function FloatingActionButton({ navigation }: FloatingActionButtonProps) {
  const { theme } = useTheme();
  const tabBarHeight = useSafeBottomTabBarHeight();

  const handlePress = () => {
    navigation.navigate('CreateSplitSelectFriends');
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        { 
          backgroundColor: theme.primary,
          bottom: tabBarHeight + Spacing.xl,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        }
      ]}
      onPress={handlePress}
    >
      <Feather name="plus" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
