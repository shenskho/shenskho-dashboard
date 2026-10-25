import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 یک ماژول نیتیو است و نباید باندل شود
  serverExternalPackages: ['better-sqlite3', 'pg'],
  // از ساخت خودکار AGENTS.md / CLAUDE.md توسط نکست جلوگیری می‌کنه
  agentRules: false,
};

export default nextConfig;
