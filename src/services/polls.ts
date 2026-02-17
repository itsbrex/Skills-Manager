import { invoke } from "@tauri-apps/api/core";
import {
  Poll,
  PollClientState,
  PollResult,
  PollVote,
  PollVoteRequest,
} from "@/types";

export class PollApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PollApiError";
    this.status = status;
    this.code = code;
  }
}

export function isPollApiError(error: unknown): error is PollApiError {
  return error instanceof PollApiError;
}

function normalizeLocale(locale?: string): string | undefined {
  const normalized = locale?.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized;
}

function toPollApiError(error: unknown): PollApiError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const parsed = rawMessage.match(/^([A-Z_0-9]+):\s*(.+)$/);
  if (parsed) {
    return new PollApiError(parsed[2], 0, parsed[1]);
  }
  return new PollApiError(rawMessage || "未知错误", 0);
}

async function invokePollCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    throw toPollApiError(error);
  }
}

export async function fetchPolls(locale?: string): Promise<Poll[]> {
  return invokePollCommand<Poll[]>("fetch_polls", {
    locale: normalizeLocale(locale),
  });
}

export async function fetchPollResults(
  pollId: string,
  locale?: string,
): Promise<PollResult> {
  return invokePollCommand<PollResult>("fetch_poll_results", {
    pollId,
    locale: normalizeLocale(locale),
  });
}

export async function submitPollVote(
  pollId: string,
  voteRequest: PollVoteRequest,
): Promise<PollVote> {
  return invokePollCommand<PollVote>("submit_poll_vote", {
    pollId,
    request: voteRequest,
  });
}

export async function getPollClientState(): Promise<PollClientState> {
  return invokePollCommand<PollClientState>("get_poll_client_state");
}

export async function savePollClientState(
  state: PollClientState,
): Promise<void> {
  await invokePollCommand("save_poll_client_state", { state });
}
