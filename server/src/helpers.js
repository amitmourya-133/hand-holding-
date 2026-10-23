import { Notification } from './models.js';
import { emitToUser } from './socket.js';

export async function notify(userId, { type = 'info', title, body = '', link = '' }) {
  if (!userId) return null;
  const notification = await Notification.create({ user: userId, type, title, body, link });
  emitToUser(String(userId), 'notification:new', notification);
  return notification;
}
