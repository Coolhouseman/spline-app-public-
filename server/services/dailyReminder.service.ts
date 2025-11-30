import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface UnpaidParticipant {
  user_id: string;
  total_pending: number;
  event_count: number;
  push_token: string | null;
  user_name: string;
}

export class DailyReminderService {
  private static reminderInterval: NodeJS.Timeout | null = null;
  private static readonly REMINDER_HOUR = 9;
  private static lastReminderDate: string | null = null;

  static async start(): Promise<void> {
    console.log('Daily reminder service starting...');
    
    this.checkAndSendReminders();
    
    this.reminderInterval = setInterval(() => {
      this.checkAndSendReminders();
    }, 60 * 60 * 1000);
    
    console.log('Daily reminder service started - will check hourly and send at 9 AM');
  }

  static stop(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
      console.log('Daily reminder service stopped');
    }
  }

  private static async checkAndSendReminders(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];

    if (currentHour === this.REMINDER_HOUR && this.lastReminderDate !== today) {
      console.log(`Sending daily reminders at ${now.toISOString()}`);
      await this.sendDailyReminders();
      this.lastReminderDate = today;
    }
  }

  static async sendDailyReminders(): Promise<void> {
    try {
      console.log('Fetching users with unpaid splits...');

      const { data: unpaidParticipants, error } = await supabaseAdmin
        .from('split_participants')
        .select(`
          user_id,
          amount,
          status,
          is_creator,
          split_events!inner (
            id,
            name,
            creator_id
          )
        `)
        .in('status', ['pending', 'accepted'])
        .eq('is_creator', false);

      if (error) {
        console.error('Error fetching unpaid participants:', error);
        return;
      }

      if (!unpaidParticipants || unpaidParticipants.length === 0) {
        console.log('No users with unpaid splits found');
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(unpaidParticipants.map(p => p.user_id))];
      
      // Fetch user details separately - using * to get all columns
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('*')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching user details:', usersError);
        // Continue without user details rather than returning
        console.log('Continuing with limited user info');
      }

      const usersMap = new Map(users?.map(u => [u.id, u]) || []);

      const userSummaries = new Map<string, {
        userId: string;
        userName: string;
        pushToken: string | null;
        totalAmount: number;
        eventCount: number;
        eventNames: string[];
      }>();

      for (const participant of unpaidParticipants) {
        const userId = participant.user_id;
        const user = usersMap.get(userId);
        const event = participant.split_events as any;

        if (!userSummaries.has(userId)) {
          userSummaries.set(userId, {
            userId,
            userName: user?.name || 'User',
            pushToken: user?.push_token || null,
            totalAmount: 0,
            eventCount: 0,
            eventNames: [],
          });
        }

        const summary = userSummaries.get(userId)!;
        summary.totalAmount += parseFloat(participant.amount) || 0;
        summary.eventCount += 1;
        if (event?.name && !summary.eventNames.includes(event.name)) {
          summary.eventNames.push(event.name);
        }
      }

      console.log(`Found ${userSummaries.size} users with unpaid splits`);

      for (const [userId, summary] of userSummaries) {
        await this.sendReminderToUser(summary);
      }

      console.log('Daily reminders sent successfully');
    } catch (error) {
      console.error('Error sending daily reminders:', error);
    }
  }

  private static async sendReminderToUser(summary: {
    userId: string;
    userName: string;
    pushToken: string | null;
    totalAmount: number;
    eventCount: number;
    eventNames: string[];
  }): Promise<void> {
    const { userId, userName, pushToken, totalAmount, eventCount, eventNames } = summary;

    const title = 'Payment Reminder';
    const eventList = eventNames.length <= 2 
      ? eventNames.join(' and ')
      : `${eventNames.slice(0, 2).join(', ')} and ${eventNames.length - 2} more`;
    
    const message = eventCount === 1
      ? `Hi ${userName}, you have $${totalAmount.toFixed(2)} pending for "${eventList}". Tap to pay now!`
      : `Hi ${userName}, you have $${totalAmount.toFixed(2)} pending across ${eventCount} splits (${eventList}). Tap to settle up!`;

    try {
      // Check if user already received a payment reminder today (regardless of read status)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: existingCount } = await supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'payment_reminder')
        .gte('created_at', today.toISOString());

      if (existingCount && existingCount > 0) {
        console.log(`User ${userId} already received a payment reminder today, skipping`);
        return;
      }

      const { error: notifError } = await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'payment_reminder',
        title,
        message,
        metadata: {
          total_amount: totalAmount,
          event_count: eventCount,
          event_names: eventNames,
        },
        read: false,
      });

      if (notifError) {
        console.error(`Failed to create in-app notification for user ${userId}:`, notifError);
      } else {
        console.log(`In-app notification created for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error creating in-app notification for user ${userId}:`, error);
    }

    if (pushToken) {
      try {
        const pushMessage = {
          to: pushToken,
          sound: 'default',
          title,
          body: message,
          data: {
            type: 'payment_reminder',
            totalAmount,
            eventCount,
          },
          priority: 'high' as const,
          badge: eventCount,
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushMessage),
        });

        const result = await response.json() as { data?: Array<{ status: string; message?: string }> };
        
        if (result.data?.[0]?.status === 'ok') {
          console.log(`Push notification sent to user ${userId}`);
        } else if (result.data?.[0]?.status === 'error') {
          console.error(`Push notification error for user ${userId}:`, result.data?.[0]?.message);
        }
      } catch (error) {
        console.error(`Error sending push notification to user ${userId}:`, error);
      }
    } else {
      console.log(`No push token for user ${userId}, skipping push notification`);
    }
  }

  static async sendTestReminder(): Promise<{ usersNotified: number; message: string }> {
    console.log('Sending test daily reminders...');
    await this.sendDailyReminders();
    return {
      usersNotified: 0,
      message: 'Test reminders sent. Check logs for details.',
    };
  }
}
