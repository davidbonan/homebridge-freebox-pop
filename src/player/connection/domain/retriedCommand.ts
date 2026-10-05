import { setTimeout as sleep } from 'node:timers/promises';

export interface CommandRun {
  signal: AbortSignal;
  onAttemptFailed: (attempt: number, error: unknown) => void;
}

export interface RetryPolicy {
  attempts: number;
  retryDelayMs: number;
}

export async function retried(attemptOnce: () => Promise<void>, run: CommandRun, policy: RetryPolicy): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptOnce();
    } catch (error) {
      if (run.signal.aborted || attempt >= policy.attempts) throw error;
      run.onAttemptFailed(attempt, error);
      await sleep(policy.retryDelayMs * attempt, undefined, { signal: run.signal });
    }
  }
}
