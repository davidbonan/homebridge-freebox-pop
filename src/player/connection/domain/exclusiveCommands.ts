export type CommandOutcome = 'done' | 'cancelled';

type Command = (signal: AbortSignal) => Promise<void>;

interface CommandInProgress {
  name: string;
  cancellation: AbortController;
}

export class ExclusiveCommands {
  private inProgress: CommandInProgress | undefined;
  private previous: Promise<unknown> = Promise.resolve();

  run(name: string, command: Command): Promise<CommandOutcome> {
    this.inProgress?.cancellation.abort();
    const cancellation = new AbortController();
    this.inProgress = { name, cancellation };
    // a cancelled command may still be seeing a power press through: the next one waits for it to end
    const outcome = this.previous.then(() => outcomeOf(command, cancellation.signal));
    this.previous = outcome.catch(() => undefined);
    return outcome;
  }

  cancel(name: string): void {
    if (this.inProgress?.name === name) this.inProgress.cancellation.abort();
  }
}

async function outcomeOf(command: Command, signal: AbortSignal): Promise<CommandOutcome> {
  if (signal.aborted) return 'cancelled';
  try {
    await command(signal);
    return 'done';
  } catch (error) {
    if (signal.aborted) return 'cancelled';
    throw error;
  }
}
