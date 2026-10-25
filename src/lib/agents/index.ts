import type { AgentRun } from '../types';
import { runLinkedInAgent } from './linkedin';

/** رجیستری دستیارهای واقعی — تا این دستیار برای یک slug پیاده نشده، اجرای دستی‌اش خطای روشن می‌ده */
export const AGENT_RUNNERS: Record<string, () => Promise<AgentRun>> = {
  'linkedin-content': runLinkedInAgent,
};

export function isAgentImplemented(slug: string): boolean {
  return slug in AGENT_RUNNERS;
}
