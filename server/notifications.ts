/**
 * Уведомления. notify() — единая точка доставки: сейчас один канал (in-app, таблица notifications),
 * позже в CHANNELS добавляются push / e-mail / мессенджер без изменения вызывающего кода.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db, storage } from "./storage";
import { notifications, players, type Notification, type NotificationType, type PlayerProfile } from "@shared/schema";
import { EXPIRY_REMINDER_EVERY_HOURS, NOTIFICATIONS_LIMIT } from "@shared/rules";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

type Channel = (playerId: number, n: NotificationInput) => void;

const inApp: Channel = (playerId, n) => {
  db.insert(notifications)
    .values({ playerId, type: n.type, title: n.title, body: n.body, link: n.link ?? null, createdAt: Date.now() })
    .run();
};

const CHANNELS: Channel[] = [inApp];

export function notify(playerId: number, n: NotificationInput) {
  for (const send of CHANNELS) send(playerId, n);
}

export function notifyAll(n: NotificationInput) {
  for (const p of db.select().from(players).all()) notify(p.id, n);
}

const hasSince = (playerId: number, type: NotificationType, since: number, title?: string) =>
  db
    .select()
    .from(notifications)
    .where(and(eq(notifications.playerId, playerId), eq(notifications.type, type), gte(notifications.createdAt, since)))
    .all()
    .some((n) => title === undefined || n.title === title);

/**
 * Проверки на сервере при опросе: о каждом активном челлендже — один раз,
 * о сгорающих баллах — не чаще EXPIRY_REMINDER_EVERY_HOURS.
 */
export function syncNotifications(name: string) {
  const player = storage.getOrCreatePlayer(name);
  for (const c of storage.challengesFor(player.id)) {
    const title = `Новый челлендж: «${c.title}»`;
    if (c.done || hasSince(player.id, "challenge_started", 0, title)) continue;
    notify(player.id, { type: "challenge_started", title, body: `${c.description}. Награда +${c.rewardXp} XP.`, link: "/profile" });
  }
  const expiring = storage.getProfile(name)?.expiring;
  if (expiring && !hasSince(player.id, "points_expiring", Date.now() - EXPIRY_REMINDER_EVERY_HOURS * 3600_000)) {
    notify(player.id, {
      type: "points_expiring",
      title: `Сгорают баллы: ${expiring.points}`,
      body: `Через ${expiring.inDays} дн. сгорит ${expiring.points} баллов практики. Пройдите проверочный рейс, чтобы удержать место в рейтинге.`,
      link: "/leaderboard",
    });
  }
  return player;
}

export function listNotifications(playerId: number): Notification[] {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.playerId, playerId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(NOTIFICATIONS_LIMIT)
    .all();
}

export function markRead(id: number, playerId: number) {
  return db
    .update(notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(notifications.id, id), eq(notifications.playerId, playerId)))
    .returning()
    .get();
}

/** Сравнить профиль до и после попытки: новые ачивки и новый уровень */
export function notifyAttemptOutcome(playerId: number, before: PlayerProfile, after: PlayerProfile) {
  const had = new Set(before.achievements.filter((a) => a.unlocked).map((a) => a.id));
  for (const a of after.achievements) {
    if (a.unlocked && !had.has(a.id))
      notify(playerId, { type: "achievement", title: `Достижение: «${a.title}»`, body: a.description, link: "/profile" });
  }
  if (after.level.level > before.level.level)
    notify(playerId, {
      type: "level_up",
      title: `Новый уровень: ${after.level.title}`,
      body: `Вы достигли уровня ${after.level.level} (${after.level.xp} XP).`,
      link: "/profile",
    });
}
