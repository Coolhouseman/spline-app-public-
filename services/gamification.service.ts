import { supabase } from './supabase';

export interface GamificationProfile {
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  xp_progress_percent: number;
  current_streak: number;
  longest_streak: number;
  title: string;
  splits_created: number;
  splits_paid_on_time: number;
  splits_completed_as_creator: number;
  total_amount_split: number;
  friends_referred: number;
  badges: Badge[];
  recent_xp: XPHistoryItem[];
}

export interface Badge {
  badge_id: string;
  badge_name: string;
  badge_description: string;
  badge_icon: string;
  badge_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earned_at: string;
}

export interface XPHistoryItem {
  xp_amount: number;
  action_type: string;
  description: string;
  created_at: string;
}

export interface XPAwardResult {
  success: boolean;
  xp_awarded: number;
  new_total_xp: number;
  new_level: number;
  xp_to_next_level: number;
  leveled_up: boolean;
  old_level: number;
  new_title: string;
}

// XP Values for different actions
export const XP_VALUES = {
  // Split Creation (creator reward)
  SPLIT_CREATED: 25,              // Base XP for creating a split
  SPLIT_CREATED_LARGE: 40,        // Bonus for splits over $100
  SPLIT_CREATED_GROUP: 15,        // Per additional participant beyond 2
  
  // Payment Actions
  SPLIT_PAID: 20,                 // Base XP for paying your share
  SPLIT_PAID_FAST: 35,            // Bonus for paying within 1 hour
  SPLIT_PAID_SAME_DAY: 28,        // Bonus for paying same day
  
  // Completion Bonuses
  SPLIT_COMPLETED_CREATOR: 50,    // Creator bonus when 100% complete
  SPLIT_COMPLETED_PARTICIPANT: 15, // Participant bonus when split completes
  
  // Streak Bonuses (calculated dynamically)
  STREAK_WEEKLY: 20,              // 7-day streak bonus
  STREAK_MONTHLY: 100,            // 30-day streak bonus
  
  // Special Achievements
  FIRST_SPLIT_CREATED: 50,        // First time creating a split
  FIRST_SPLIT_PAID: 30,           // First time paying a split
  REFERRAL_BONUS: 75,             // When a referred friend joins
  
  // Milestone bonuses
  SPLITS_10_CREATED: 100,
  SPLITS_25_CREATED: 250,
  SPLITS_50_CREATED: 500,
  SPLITS_100_CREATED: 1000,
};

// Level titles and their perks
export const LEVEL_INFO: Record<number, { title: string; perk?: string }> = {
  1: { title: 'Newcomer' },
  3: { title: 'Getting Started' },
  5: { title: 'Active Member' },
  7: { title: 'Rising Star' },
  10: { title: 'Trusted Splitter', perk: 'Priority support access' },
  15: { title: 'Split Champion', perk: 'Extended withdrawal limits' },
  20: { title: 'Payment Pro', perk: '10% discount on fast withdrawals' },
  25: { title: 'Bill Boss', perk: 'VIP restaurant partner discounts' },
  30: { title: 'Split Legend', perk: 'Hotel partner benefits' },
  40: { title: 'Master Organizer', perk: 'Airport lounge access (coming soon)' },
  50: { title: 'Elite Splitter', perk: 'Premium concierge service' },
};

// Badge definitions
export const BADGE_DEFINITIONS = {
  // Starter badges
  first_split: {
    id: 'first_split',
    name: 'First Steps',
    description: 'Created your first split',
    icon: 'star',
    tier: 'bronze' as const,
  },
  first_payment: {
    id: 'first_payment',
    name: 'Team Player',
    description: 'Paid your first split share',
    icon: 'check-circle',
    tier: 'bronze' as const,
  },
  
  // Creator badges
  split_starter: {
    id: 'split_starter',
    name: 'Split Starter',
    description: 'Created 10 splits',
    icon: 'layers',
    tier: 'bronze' as const,
  },
  split_organizer: {
    id: 'split_organizer',
    name: 'Event Organizer',
    description: 'Created 25 splits',
    icon: 'calendar',
    tier: 'silver' as const,
  },
  split_master: {
    id: 'split_master',
    name: 'Split Master',
    description: 'Created 50 splits',
    icon: 'award',
    tier: 'gold' as const,
  },
  split_legend: {
    id: 'split_legend',
    name: 'Legendary Organizer',
    description: 'Created 100 splits',
    icon: 'zap',
    tier: 'platinum' as const,
  },
  
  // Payer badges
  reliable_payer: {
    id: 'reliable_payer',
    name: 'Reliable',
    description: 'Paid 10 splits on time',
    icon: 'thumbs-up',
    tier: 'bronze' as const,
  },
  trusted_payer: {
    id: 'trusted_payer',
    name: 'Trusted Friend',
    description: 'Paid 25 splits on time',
    icon: 'shield',
    tier: 'silver' as const,
  },
  perfect_record: {
    id: 'perfect_record',
    name: 'Perfect Record',
    description: 'Paid 50 splits on time',
    icon: 'check-square',
    tier: 'gold' as const,
  },
  
  // Speed badges
  lightning_payer: {
    id: 'lightning_payer',
    name: 'Lightning Fast',
    description: 'Paid 5 splits within 1 hour',
    icon: 'zap',
    tier: 'silver' as const,
  },
  
  // Completion badges
  completion_champion: {
    id: 'completion_champion',
    name: 'Completion Champion',
    description: 'Led 10 splits to 100% completion',
    icon: 'target',
    tier: 'silver' as const,
  },
  full_house: {
    id: 'full_house',
    name: 'Full House',
    description: 'Led 25 splits to 100% completion',
    icon: 'users',
    tier: 'gold' as const,
  },
  
  // Streak badges
  week_warrior: {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Maintained a 7-day activity streak',
    icon: 'trending-up',
    tier: 'bronze' as const,
  },
  month_master: {
    id: 'month_master',
    name: 'Monthly Master',
    description: 'Maintained a 30-day activity streak',
    icon: 'calendar',
    tier: 'gold' as const,
  },
  
  // Social badges
  social_butterfly: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Split bills with 10+ different friends',
    icon: 'users',
    tier: 'silver' as const,
  },
  community_builder: {
    id: 'community_builder',
    name: 'Community Builder',
    description: 'Referred 3 friends to Spline',
    icon: 'gift',
    tier: 'gold' as const,
  },
};

// Level thresholds for calculating level from XP
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000, 21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500, 46500, 49600, 52800, 56100, 59500, 63000, 66600, 70300, 74100, 78000, 82000, 86100, 90300, 94600, 99000, 103500, 108100, 112800, 117600, 122500];

function calculateLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

function calculateXPToNextLevel(totalXP: number, currentLevel: number): number {
  if (currentLevel >= LEVEL_THRESHOLDS.length) return 0;
  return LEVEL_THRESHOLDS[currentLevel] - totalXP;
}

function getTitleForLevel(level: number): string {
  if (level >= 50) return 'Elite Splitter';
  if (level >= 40) return 'Master Organizer';
  if (level >= 30) return 'Split Legend';
  if (level >= 25) return 'Bill Boss';
  if (level >= 20) return 'Payment Pro';
  if (level >= 15) return 'Split Champion';
  if (level >= 10) return 'Trusted Splitter';
  if (level >= 7) return 'Rising Star';
  if (level >= 5) return 'Active Member';
  if (level >= 3) return 'Getting Started';
  return 'Newcomer';
}

export class GamificationService {
  /**
   * Initialize gamification profile for a new user
   * Uses direct table insert as fallback if RPC function doesn't exist
   */
  static async initializeUser(userId: string): Promise<void> {
    try {
      // First try RPC
      const { error: rpcError } = await supabase.rpc('initialize_user_gamification', {
        p_user_id: userId
      });
      
      if (rpcError) {
        // Fallback: Direct table insert
        console.log('RPC not available, using direct insert for gamification init');
        const { error: insertError } = await supabase
          .from('user_gamification')
          .upsert({
            user_id: userId,
            total_xp: 0,
            current_level: 1,
            splits_paid: 0,
            splits_created: 0,
            current_streak: 0,
            longest_streak: 0,
            friends_referred: 0,
            total_completed_splits: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('Failed to initialize gamification (direct):', insertError);
        }
      }
    } catch (error) {
      console.error('Failed to initialize gamification:', error);
    }
  }

  /**
   * Get user's gamification profile
   * Returns a default profile if gamification tables don't exist
   */
  static async getProfile(userId: string): Promise<GamificationProfile | null> {
    try {
      // First try RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_gamification', {
        p_user_id: userId
      });

      if (!rpcError && rpcData) {
        return rpcData as GamificationProfile;
      }

      // RPC failed - try direct table query
      const { data: profile, error: profileError } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileError && profile) {
        return this.buildProfileFromData(userId, profile);
      }

      // If the table doesn't exist or profile not found, return a sensible default
      // This ensures the UI always has something to display
      console.log('Gamification data not available, returning default profile');
      return this.getDefaultProfile();
    } catch (error) {
      console.error('Error getting gamification profile:', error);
      return this.getDefaultProfile();
    }
  }
  
  /**
   * Get a default profile for users without gamification data
   */
  static getDefaultProfile(): GamificationProfile {
    return {
      total_xp: 0,
      current_level: 1,
      xp_to_next_level: 100,
      xp_progress_percent: 0,
      current_streak: 0,
      longest_streak: 0,
      title: 'Newcomer',
      splits_created: 0,
      splits_paid_on_time: 0,
      splits_completed_as_creator: 0,
      total_amount_split: 0,
      friends_referred: 0,
      badges: [],
      recent_xp: []
    };
  }

  /**
   * Build a GamificationProfile from raw database data
   */
  private static async buildProfileFromData(userId: string, data: any): Promise<GamificationProfile> {
    const totalXP = data.total_xp || 0;
    const currentLevel = data.current_level || calculateLevel(totalXP);
    const xpToNextLevel = calculateXPToNextLevel(totalXP, currentLevel);
    const currentLevelThreshold = currentLevel > 0 ? LEVEL_THRESHOLDS[currentLevel - 1] : 0;
    const nextLevelThreshold = currentLevel < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[currentLevel] : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const xpProgress = nextLevelThreshold > currentLevelThreshold 
      ? ((totalXP - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)) * 100
      : 100;

    // Fetch badges
    const { data: badges } = await supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', userId);

    // Fetch recent XP history
    const { data: recentXP } = await supabase
      .from('xp_history')
      .select('xp_amount, action_type, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const formattedBadges: Badge[] = (badges || []).map(b => {
      const badgeDef = BADGE_DEFINITIONS[b.badge_id as keyof typeof BADGE_DEFINITIONS];
      return {
        badge_id: b.badge_id,
        badge_name: badgeDef?.name || b.badge_id,
        badge_description: badgeDef?.description || '',
        badge_icon: badgeDef?.icon || 'award',
        badge_tier: badgeDef?.tier || 'bronze',
        earned_at: b.earned_at
      };
    });

    return {
      total_xp: totalXP,
      current_level: currentLevel,
      xp_to_next_level: xpToNextLevel,
      xp_progress_percent: Math.min(100, Math.max(0, xpProgress)),
      current_streak: data.current_streak || 0,
      longest_streak: data.longest_streak || 0,
      title: getTitleForLevel(currentLevel),
      splits_created: data.splits_created || 0,
      splits_paid_on_time: data.splits_paid || 0,
      splits_completed_as_creator: data.total_completed_splits || 0,
      total_amount_split: 0, // Not tracked directly
      friends_referred: data.friends_referred || 0,
      badges: formattedBadges,
      recent_xp: (recentXP || []).map(x => ({
        xp_amount: x.xp_amount,
        action_type: x.action_type,
        description: x.description,
        created_at: x.created_at
      }))
    };
  }

  /**
   * Award XP to a user
   * Returns null if gamification system is not available (non-blocking)
   */
  static async awardXP(
    userId: string,
    xpAmount: number,
    actionType: string,
    description: string,
    splitEventId?: string
  ): Promise<XPAwardResult | null> {
    try {
      const { data, error } = await supabase.rpc('award_xp', {
        p_user_id: userId,
        p_xp_amount: xpAmount,
        p_action_type: actionType,
        p_description: description,
        p_split_event_id: splitEventId || null
      });

      if (error) {
        // Log but don't throw - gamification is non-blocking
        console.log('Gamification: XP award skipped (RPC not available):', actionType, xpAmount);
        return null;
      }

      // Update streak as well (non-blocking)
      this.updateStreak(userId).catch(() => {});

      return data as XPAwardResult;
    } catch (error) {
      console.log('Gamification: XP award skipped (error):', actionType);
      return null;
    }
  }

  /**
   * Update user's activity streak
   * Non-blocking - returns null if gamification not available
   */
  static async updateStreak(userId: string): Promise<{ new_streak: number; streak_bonus_xp: number } | null> {
    try {
      const { data, error } = await supabase.rpc('update_user_streak', {
        p_user_id: userId
      });

      if (error) {
        console.log('Gamification: Streak update skipped (RPC not available)');
        return null;
      }

      // If there's a streak bonus, award it (non-blocking)
      if (data?.streak_bonus_xp > 0) {
        this.awardXP(
          userId,
          data.streak_bonus_xp,
          'streak_bonus',
          `${data.new_streak}-day streak bonus!`
        ).catch(() => {});
      }

      return data;
    } catch (error) {
      console.log('Gamification: Streak update skipped (error)');
      return null;
    }
  }

  /**
   * Update a specific stat
   * Non-blocking - logs and continues if gamification not available
   */
  static async updateStat(
    userId: string,
    statType: 'splits_created' | 'splits_paid_on_time' | 'splits_completed_as_creator' | 'total_amount_split' | 'friends_referred',
    amount: number = 1
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_gamification_stats', {
        p_user_id: userId,
        p_stat_type: statType,
        p_amount: amount
      });
      
      if (error) {
        console.log('Gamification: Stat update skipped (RPC not available):', statType);
      }
    } catch (error) {
      console.log('Gamification: Stat update skipped (error):', statType);
    }
  }

  /**
   * Award a badge to user
   * Non-blocking - returns false if gamification not available
   */
  static async awardBadge(
    userId: string,
    badgeId: keyof typeof BADGE_DEFINITIONS
  ): Promise<boolean> {
    const badge = BADGE_DEFINITIONS[badgeId];
    if (!badge) return false;

    try {
      const { data, error } = await supabase.rpc('award_badge', {
        p_user_id: userId,
        p_badge_id: badge.id,
        p_badge_name: badge.name,
        p_badge_description: badge.description,
        p_badge_icon: badge.icon,
        p_badge_tier: badge.tier
      });

      if (error) {
        console.log('Gamification: Badge award skipped (RPC not available):', badgeId);
        return false;
      }

      return data?.success || false;
    } catch (error) {
      console.log('Gamification: Badge award skipped (error):', badgeId);
      return false;
    }
  }

  /**
   * Check and award badges based on stats
   */
  static async checkAndAwardBadges(userId: string): Promise<string[]> {
    const profile = await this.getProfile(userId);
    if (!profile) return [];

    const awardedBadges: string[] = [];
    const existingBadgeIds = new Set(profile.badges.map(b => b.badge_id));

    // Check creator milestones
    if (profile.splits_created >= 1 && !existingBadgeIds.has('first_split')) {
      if (await this.awardBadge(userId, 'first_split')) {
        awardedBadges.push('first_split');
      }
    }
    if (profile.splits_created >= 10 && !existingBadgeIds.has('split_starter')) {
      if (await this.awardBadge(userId, 'split_starter')) {
        awardedBadges.push('split_starter');
      }
    }
    if (profile.splits_created >= 25 && !existingBadgeIds.has('split_organizer')) {
      if (await this.awardBadge(userId, 'split_organizer')) {
        awardedBadges.push('split_organizer');
      }
    }
    if (profile.splits_created >= 50 && !existingBadgeIds.has('split_master')) {
      if (await this.awardBadge(userId, 'split_master')) {
        awardedBadges.push('split_master');
      }
    }
    if (profile.splits_created >= 100 && !existingBadgeIds.has('split_legend')) {
      if (await this.awardBadge(userId, 'split_legend')) {
        awardedBadges.push('split_legend');
      }
    }

    // Check payer milestones
    if (profile.splits_paid_on_time >= 1 && !existingBadgeIds.has('first_payment')) {
      if (await this.awardBadge(userId, 'first_payment')) {
        awardedBadges.push('first_payment');
      }
    }
    if (profile.splits_paid_on_time >= 10 && !existingBadgeIds.has('reliable_payer')) {
      if (await this.awardBadge(userId, 'reliable_payer')) {
        awardedBadges.push('reliable_payer');
      }
    }
    if (profile.splits_paid_on_time >= 25 && !existingBadgeIds.has('trusted_payer')) {
      if (await this.awardBadge(userId, 'trusted_payer')) {
        awardedBadges.push('trusted_payer');
      }
    }
    if (profile.splits_paid_on_time >= 50 && !existingBadgeIds.has('perfect_record')) {
      if (await this.awardBadge(userId, 'perfect_record')) {
        awardedBadges.push('perfect_record');
      }
    }

    // Check completion milestones
    if (profile.splits_completed_as_creator >= 10 && !existingBadgeIds.has('completion_champion')) {
      if (await this.awardBadge(userId, 'completion_champion')) {
        awardedBadges.push('completion_champion');
      }
    }
    if (profile.splits_completed_as_creator >= 25 && !existingBadgeIds.has('full_house')) {
      if (await this.awardBadge(userId, 'full_house')) {
        awardedBadges.push('full_house');
      }
    }

    // Check streak milestones
    if (profile.longest_streak >= 7 && !existingBadgeIds.has('week_warrior')) {
      if (await this.awardBadge(userId, 'week_warrior')) {
        awardedBadges.push('week_warrior');
      }
    }
    if (profile.longest_streak >= 30 && !existingBadgeIds.has('month_master')) {
      if (await this.awardBadge(userId, 'month_master')) {
        awardedBadges.push('month_master');
      }
    }

    // Check referral milestones
    if (profile.friends_referred >= 3 && !existingBadgeIds.has('community_builder')) {
      if (await this.awardBadge(userId, 'community_builder')) {
        awardedBadges.push('community_builder');
      }
    }

    return awardedBadges;
  }

  /**
   * Handle split creation - award XP to creator
   */
  static async onSplitCreated(
    creatorId: string,
    splitEventId: string,
    totalAmount: number,
    participantCount: number
  ): Promise<XPAwardResult | null> {
    // Get current profile to check if first split
    const profile = await this.getProfile(creatorId);
    const isFirstSplit = !profile || profile.splits_created === 0;

    // Calculate XP
    let xp = XP_VALUES.SPLIT_CREATED;
    let description = 'Created a new split';

    // Bonus for large splits
    if (totalAmount >= 100) {
      xp += XP_VALUES.SPLIT_CREATED_LARGE - XP_VALUES.SPLIT_CREATED;
      description = 'Created a large split ($100+)';
    }

    // Bonus for group splits (more than 2 people)
    if (participantCount > 2) {
      xp += XP_VALUES.SPLIT_CREATED_GROUP * (participantCount - 2);
      description = `Created a group split with ${participantCount} people`;
    }

    // First split bonus
    if (isFirstSplit) {
      xp += XP_VALUES.FIRST_SPLIT_CREATED;
      description = 'Created your first split!';
    }

    // Update stats
    await this.updateStat(creatorId, 'splits_created');
    await this.updateStat(creatorId, 'total_amount_split', totalAmount);

    // Award XP
    const result = await this.awardXP(creatorId, xp, 'split_created', description, splitEventId);

    // Check for new badges
    await this.checkAndAwardBadges(creatorId);

    return result;
  }

  /**
   * Handle split payment - award XP to payer
   */
  static async onSplitPaid(
    payerId: string,
    splitEventId: string,
    amount: number,
    splitCreatedAt: Date
  ): Promise<XPAwardResult | null> {
    const profile = await this.getProfile(payerId);
    const isFirstPayment = !profile || profile.splits_paid_on_time === 0;

    // Calculate time since split was created
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - splitCreatedAt.getTime()) / (1000 * 60 * 60);

    let xp = XP_VALUES.SPLIT_PAID;
    let description = 'Paid your share';

    // Speed bonuses
    if (hoursSinceCreation <= 1) {
      xp = XP_VALUES.SPLIT_PAID_FAST;
      description = 'Paid within 1 hour - Lightning fast!';
    } else if (hoursSinceCreation <= 24) {
      xp = XP_VALUES.SPLIT_PAID_SAME_DAY;
      description = 'Paid same day - Quick response!';
    }

    // First payment bonus
    if (isFirstPayment) {
      xp += XP_VALUES.FIRST_SPLIT_PAID;
      description = 'Paid your first split share!';
    }

    // Update stats
    await this.updateStat(payerId, 'splits_paid_on_time');

    // Award XP
    const result = await this.awardXP(payerId, xp, 'split_paid', description, splitEventId);

    // Check for new badges
    await this.checkAndAwardBadges(payerId);

    return result;
  }

  /**
   * Handle split completion (100%) - award bonus to creator and all participants
   */
  static async onSplitCompleted(
    creatorId: string,
    splitEventId: string,
    participantIds: string[]
  ): Promise<void> {
    // Award creator bonus
    await this.updateStat(creatorId, 'splits_completed_as_creator');
    await this.awardXP(
      creatorId,
      XP_VALUES.SPLIT_COMPLETED_CREATOR,
      'split_completed',
      'Split reached 100% completion! Leadership bonus.',
      splitEventId
    );

    // Award participant bonuses (excluding creator)
    for (const participantId of participantIds) {
      if (participantId !== creatorId) {
        await this.awardXP(
          participantId,
          XP_VALUES.SPLIT_COMPLETED_PARTICIPANT,
          'split_completed',
          'Contributed to a completed split!',
          splitEventId
        );
      }
    }

    // Check badges for creator
    await this.checkAndAwardBadges(creatorId);
  }

  /**
   * Get level info including title and perks
   */
  static getLevelInfo(level: number): { title: string; perk?: string; nextPerkLevel?: number } {
    // Find the highest level info that applies
    let currentInfo = { title: 'Newcomer' };
    let nextPerkLevel: number | undefined;

    for (const [lvl, info] of Object.entries(LEVEL_INFO).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const levelNum = Number(lvl);
      if (levelNum <= level) {
        currentInfo = info;
      } else if (info.perk && !nextPerkLevel) {
        nextPerkLevel = levelNum;
      }
    }

    return { ...currentInfo, nextPerkLevel };
  }

  /**
   * Calculate XP needed for a specific level
   */
  static getXPForLevel(level: number): number {
    // Exponential scaling formula
    let totalXP = 0;
    let levelXP = 100;
    for (let i = 1; i < level; i++) {
      totalXP += levelXP;
      levelXP += (i + 1) * 75;
    }
    return totalXP;
  }

  /**
   * Get simple level badge color based on level
   */
  static getLevelColor(level: number): string {
    if (level >= 50) return '#FFD700'; // Gold
    if (level >= 30) return '#C0C0C0'; // Silver
    if (level >= 20) return '#CD7F32'; // Bronze
    if (level >= 10) return '#9370DB'; // Purple
    if (level >= 5) return '#4169E1';  // Royal Blue
    return '#808080'; // Gray
  }
}
