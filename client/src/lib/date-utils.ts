/**
 * Calculates the number of days between the current date and a target date.
 * Returns a positive number if the target date is in the future, or zero if it's in the past.
 * 
 * @param targetDate - The target date to calculate days until (Date object or ISO string)
 * @returns Number of days remaining until the target date, or 0 if date is in the past
 */
export function calculateDaysLeft(targetDate: Date | string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to beginning of day
  
  const deadline = new Date(targetDate);
  deadline.setHours(0, 0, 0, 0); // Set to beginning of day
  
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Formats a date as a relative time string (e.g., "2 days ago", "in 3 days")
 * 
 * @param date - The date to format (Date object or ISO string)
 * @returns A string representation of the relative time
 */
export function getRelativeTimeString(date: Date | string): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else if (diffDays === -1) {
    return "Yesterday";
  } else if (diffDays > 1 && diffDays < 7) {
    return `In ${diffDays} days`;
  } else if (diffDays < 0 && diffDays > -7) {
    return `${Math.abs(diffDays)} days ago`;
  } else {
    // Format as a proper date for dates more than a week away
    return targetDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: now.getFullYear() !== targetDate.getFullYear() ? 'numeric' : undefined
    });
  }
}

/**
 * Formats a date to a short date string in the format "MMM DD, YYYY"
 * 
 * @param date - The date to format (Date object or ISO string)
 * @returns A formatted date string
 */
export function formatShortDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

/**
 * Formats a date to show both the date and time in a user-friendly format
 * 
 * @param date - The date to format (Date object or ISO string)
 * @returns A formatted date and time string
 */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Returns true if the provided date is in the past
 * 
 * @param date - The date to check (Date object or ISO string)
 * @returns Boolean indicating if the date is in the past
 */
export function isPastDate(date: Date | string): boolean {
  const now = new Date();
  const targetDate = new Date(date);
  return targetDate < now;
}

/**
 * Returns true if the provided date is today
 * 
 * @param date - The date to check (Date object or ISO string)
 * @returns Boolean indicating if the date is today
 */
export function isToday(date: Date | string): boolean {
  const now = new Date();
  const targetDate = new Date(date);
  return (
    targetDate.getDate() === now.getDate() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getFullYear() === now.getFullYear()
  );
}

/**
 * Formats a date as a human-readable time ago string (e.g., "2 days ago", "just now")
 * 
 * @param date - The date to format (Date object or ISO string)
 * @returns A string representation of the time ago
 */
export function getTimeAgo(date: Date | string): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffTime = now.getTime() - targetDate.getTime();
  
  // Convert to appropriate time units
  const diffSeconds = Math.floor(diffTime / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSeconds < 5) {
    return "just now";
  } else if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return diffWeeks === 1 ? "1 week ago" : `${diffWeeks} weeks ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
  }
}