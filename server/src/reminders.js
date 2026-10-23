import { Meeting } from './models.js';
import { notify } from './helpers.js';

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const TICK_MS = 30 * 1000;

export function startReminderScheduler() {
  const timer = setInterval(async () => {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + REMINDER_WINDOW_MS);

      const meetings = await Meeting.find({
        status: 'accepted',
        reminderSent: { $ne: true },
        date: { $gte: now, $lte: soon },
      });

      for (const meeting of meetings) {
        meeting.reminderSent = true;
        await meeting.save();

        const minutes = Math.max(1, Math.round((new Date(meeting.date).getTime() - now.getTime()) / 60000));
        const body = `"${meeting.title}" starts in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;

        await notify(meeting.mentor, { type: 'reminder', title: 'Upcoming session reminder', body, link: '/meetings' });
        await notify(meeting.mentee, { type: 'reminder', title: 'Upcoming session reminder', body, link: '/meetings' });
      }
    } catch (err) {
      console.error('[reminders]', err.message);
    }
  }, TICK_MS);

  timer.unref();
  return timer;
}
