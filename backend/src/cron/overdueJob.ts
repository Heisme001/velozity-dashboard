import cron from 'node-cron';
import { prisma } from '../services/prisma';
import { socketManager } from '../socket/socketManager';
import { TaskStatus } from '@prisma/client';

export function startOverdueTaskCron() {
  // Run every 5 minutes (or adjust as needed)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      
      // Find tasks past due date that are not DONE and not already marked isOverdue
      const overdueTasks = await prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          status: { not: TaskStatus.DONE },
          isOverdue: false
        },
        include: {
          project: true,
          developer: true
        }
      });

      if (overdueTasks.length > 0) {
        console.log(`[Cron] Found ${overdueTasks.length} newly overdue tasks.`);
        
        for (const task of overdueTasks) {
          await prisma.task.update({
            where: { id: task.id },
            data: { isOverdue: true }
          });

          // Create notification for PM and Developer
          if (task.project.pmId) {
            const notif = await prisma.notification.create({
              data: {
                userId: task.project.pmId,
                title: 'Task Overdue Alert',
                message: `Task #${task.id} (${task.title}) in project "${task.project.title}" is now overdue!`,
                link: `/projects/${task.projectId}`
              }
            });
            socketManager.sendNotification(task.project.pmId, notif);
          }

          if (task.developerId) {
            const notif = await prisma.notification.create({
              data: {
                userId: task.developerId,
                title: 'Task Overdue Alert',
                message: `Your assigned task #${task.id} (${task.title}) has passed its due date!`,
                link: `/projects/${task.projectId}`
              }
            });
            socketManager.sendNotification(task.developerId, notif);
          }
        }
      }
    } catch (error) {
      console.error('[Cron] Error running overdue task job:', error);
    }
  });

  console.log('[Cron] Overdue task scheduler initialized (Runs every 5 mins).');
}
