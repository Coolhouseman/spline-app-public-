import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export function useSafeBottomTabBarHeight(): number {
  try {
    return useBottomTabBarHeight();
  } catch (error) {
    return 0;
  }
}
