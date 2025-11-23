import { pgTable, text, timestamp, integer, boolean, decimal, jsonb, uuid, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  uniqueId: text('unique_id').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  phone: text('phone'),
  dateOfBirth: text('date_of_birth'),
  bio: text('bio'),
  profilePicture: text('profile_picture'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const friends = pgTable('friends', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: uuid('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('accepted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueFriendship: unique().on(table.userId, table.friendId),
}));

export const splitEvents = pgTable('split_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  splitType: text('split_type').notNull(),
  receiptImage: text('receipt_image'),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const splitParticipants = pgTable('split_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  splitEventId: uuid('split_event_id').notNull().references(() => splitEvents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'),
  isCreator: boolean('is_creator').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  uniqueParticipant: unique().on(table.splitEventId, table.userId),
}));

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  balance: decimal('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
  bankConnected: boolean('bank_connected').notNull().default(false),
  bankDetails: jsonb('bank_details').$type<{ bankName?: string; accountLast4?: string; accountType?: string }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  direction: text('direction').notNull(),
  splitEventId: uuid('split_event_id').references(() => splitEvents.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  splitEventId: uuid('split_event_id').references(() => splitEvents.id, { onDelete: 'cascade' }),
  metadata: jsonb('metadata').$type<{ splitType?: string; amount?: string; creatorName?: string }>(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  friends: many(friends, { relationName: 'userFriends' }),
  friendOf: many(friends, { relationName: 'friendOfUser' }),
  createdSplits: many(splitEvents),
  splitParticipants: many(splitParticipants),
  wallet: one(wallets),
  transactions: many(transactions),
  notifications: many(notifications),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const friendsRelations = relations(friends, ({ one }) => ({
  user: one(users, {
    fields: [friends.userId],
    references: [users.id],
    relationName: 'userFriends',
  }),
  friend: one(users, {
    fields: [friends.friendId],
    references: [users.id],
    relationName: 'friendOfUser',
  }),
}));

export const splitEventsRelations = relations(splitEvents, ({ one, many }) => ({
  creator: one(users, {
    fields: [splitEvents.creatorId],
    references: [users.id],
  }),
  participants: many(splitParticipants),
  transactions: many(transactions),
  notifications: many(notifications),
}));

export const splitParticipantsRelations = relations(splitParticipants, ({ one }) => ({
  splitEvent: one(splitEvents, {
    fields: [splitParticipants.splitEventId],
    references: [splitEvents.id],
  }),
  user: one(users, {
    fields: [splitParticipants.userId],
    references: [users.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  splitEvent: one(splitEvents, {
    fields: [transactions.splitEventId],
    references: [splitEvents.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  splitEvent: one(splitEvents, {
    fields: [notifications.splitEventId],
    references: [splitEvents.id],
  }),
}));
