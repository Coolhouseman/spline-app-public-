import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LevelUpModal } from '@/components/LevelUpModal';
import { XPAwardResult } from '@/services/gamification.service';

interface LevelUpState {
  visible: boolean;
  newLevel: number;
  oldLevel: number;
  newTitle: string;
  totalXp: number;
}

interface LevelUpContextValue {
  showLevelUp: (result: XPAwardResult) => void;
  checkLevelUp: (result: XPAwardResult) => void;
}

const LevelUpContext = createContext<LevelUpContextValue | null>(null);

export function LevelUpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LevelUpState>({
    visible: false,
    newLevel: 1,
    oldLevel: 1,
    newTitle: 'Member',
    totalXp: 0,
  });

  const showLevelUp = useCallback((result: XPAwardResult) => {
    setState({
      visible: true,
      newLevel: result.new_level,
      oldLevel: result.old_level,
      newTitle: result.new_title,
      totalXp: result.new_total_xp,
    });
  }, []);

  const checkLevelUp = useCallback((result: XPAwardResult) => {
    if (result.leveled_up) {
      showLevelUp(result);
    }
  }, [showLevelUp]);

  const handleDismiss = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <LevelUpContext.Provider value={{ showLevelUp, checkLevelUp }}>
      {children}
      <LevelUpModal
        visible={state.visible}
        newLevel={state.newLevel}
        oldLevel={state.oldLevel}
        newTitle={state.newTitle}
        totalXp={state.totalXp}
        onDismiss={handleDismiss}
      />
    </LevelUpContext.Provider>
  );
}

export function useLevelUp() {
  const context = useContext(LevelUpContext);
  if (!context) {
    throw new Error('useLevelUp must be used within a LevelUpProvider');
  }
  return context;
}
