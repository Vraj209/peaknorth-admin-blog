import { DateTime } from 'luxon';
import { CadenceConfig, ScheduleSlots, TimeUntilPublish } from '../types/blog';
import logger from '../utils/logger';

/**
 * Compute the next publishing slots based on cadence configuration
 */
export function computeNextSlots(
  nowISO: string, 
  config: CadenceConfig
): ScheduleSlots {
  const now = DateTime.fromISO(nowISO, { zone: config.timezone });
  
  // Calculate next publish time
  let nextPublish = now
    .startOf('day')
    .set({ hour: config.publishHour });
  
  // If we've passed today's publish time, move to next interval
  if (nextPublish <= now) {
    nextPublish = nextPublish.plus({ days: config.intervalDays });
  }
  
  // Ensure we're on the correct interval boundary
  // Find the next slot that aligns with the interval
  const daysSinceEpoch = Math.floor(nextPublish.toSeconds() / (24 * 60 * 60));
  const intervalOffset = daysSinceEpoch % config.intervalDays;
  
  if (intervalOffset !== 0) {
    nextPublish = nextPublish.plus({ days: config.intervalDays - intervalOffset });
  }
  
  // Calculate when to create the draft (X hours before publish)
  const createAt = nextPublish.minus({ hours: config.draftLeadHours });
  
  logger.debug('Computed next slots', {
    now: now.toISO(),
    nextPublish: nextPublish.toISO(),
    createAt: createAt.toISO(),
    config,
  });
  
  return {
    scheduledAt: nextPublish.toMillis(),
    createAt: createAt.toMillis(),
  };
}

/**
 * Format a timestamp for display in a specific timezone
 */
export function formatScheduledTime(
  timestamp: number, 
  timezone: string, 
  _formatStr: string = 'PPP p'
): string {
  return DateTime
    .fromMillis(timestamp)
    .setZone(timezone)
    .toLocaleString(DateTime.DATETIME_MED);
}

/**
 * Check if a scheduled time has passed
 */
export function isScheduledTimePassed(scheduledAt: number): boolean {
  return Date.now() >= scheduledAt;
}

/**
 * Get time remaining until publish
 */
export function getTimeUntilPublish(scheduledAt: number): TimeUntilPublish {
  const now = Date.now();
  const diffMs = scheduledAt - now;
  
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, isPast: true };
  }
  
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  
  return { days, hours, minutes, isPast: false };
}

/**
 * Get a human-readable relative time string
 */
export function getRelativeTimeString(timestamp: number): string {
  const dt = DateTime.fromMillis(timestamp);
  return dt.toRelative() || 'unknown';
}

/**
 * Check if it's time to create a draft based on cadence config
 */
export function shouldCreateDraft(config: CadenceConfig): boolean {
  const now = DateTime.now().setZone(config.timezone);
  const nowIso = now.toISO();
  if (!nowIso) {
    throw new Error('Failed to convert DateTime to ISO string');
  }
  const slots = computeNextSlots(nowIso, config);
  
  // Check if we've reached the create time
  return now.toMillis() >= slots.createAt;
}

/**
 * Get the next few publishing slots for preview
 */
export function getUpcomingSlots(
  config: CadenceConfig, 
  count: number = 5
): Array<{ publishAt: number; createAt: number }> {
  const now = DateTime.now().setZone(config.timezone);
  const slots: Array<{ publishAt: number; createAt: number }> = [];
  
  const nowIso = now.toISO();
  if (!nowIso) {
    throw new Error('Failed to convert DateTime to ISO string');
  }
  let currentSlot = computeNextSlots(nowIso, config);
  
  for (let i = 0; i < count; i++) {
    slots.push({
      publishAt: currentSlot.scheduledAt,
      createAt: currentSlot.createAt,
    });
    
    // Calculate next slot
    const nextTime = DateTime.fromMillis(currentSlot.scheduledAt)
      .plus({ days: config.intervalDays });
    const nextTimeIso = nextTime.toISO();
    if (!nextTimeIso) {
      throw new Error('Failed to convert DateTime to ISO string');
    }
    currentSlot = computeNextSlots(nextTimeIso, config);
  }
  
  return slots;
}

/**
 * Validate cadence configuration
 */
export function validateCadenceConfig(config: Partial<CadenceConfig>): string[] {
  const errors: string[] = [];
  
  if (!config.intervalDays || config.intervalDays < 1) {
    errors.push('Interval days must be at least 1');
  }
  
  if (config.publishHour === undefined || config.publishHour < 0 || config.publishHour > 23) {
    errors.push('Publish hour must be between 0 and 23');
  }
  
  if (!config.timezone) {
    errors.push('Timezone is required');
  } else {
    try {
      DateTime.now().setZone(config.timezone);
    } catch (error) {
      errors.push('Invalid timezone');
    }
  }
  
  if (!config.draftLeadHours || config.draftLeadHours < 1) {
    errors.push('Draft lead hours must be at least 1');
  }
  
  return errors;
}

/**
 * Calculate optimal posting times based on historical data
 * (This is a placeholder for future analytics-based scheduling)
 */
export function getOptimalPostingTimes(
  timezone: string,
  historicalData?: Array<{ publishedAt: number; engagement: number }>
): number[] {
  // Default to common high-engagement times
  const defaultTimes = [9, 12, 15, 18]; // 9 AM, 12 PM, 3 PM, 6 PM
  
  if (!historicalData || historicalData.length < 10) {
    return defaultTimes;
  }
  
  // Analyze historical data to find best performing hours
  const hourEngagement: Record<number, { total: number; count: number }> = {};
  
  historicalData.forEach(({ publishedAt, engagement }) => {
    const hour = DateTime.fromMillis(publishedAt).setZone(timezone).hour;
    if (!hourEngagement[hour]) {
      hourEngagement[hour] = { total: 0, count: 0 };
    }
    hourEngagement[hour].total += engagement;
    hourEngagement[hour].count += 1;
  });
  
  // Calculate average engagement per hour and sort
  const avgEngagement = Object.entries(hourEngagement)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      avgEngagement: data.total / data.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 4)
    .map(item => item.hour);
  
  return avgEngagement.length >= 2 ? avgEngagement : defaultTimes;
}
