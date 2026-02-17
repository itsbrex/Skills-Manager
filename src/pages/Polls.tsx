import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PageLoader } from "@/components/ui/loading";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";
import { Poll, PollResult } from "@/types";
import {
  getPollClientState,
  fetchPollResults,
  fetchPolls,
  isPollApiError,
  savePollClientState,
  submitPollVote,
} from "@/services/polls";
import { buildPollOptionStats } from "./polls/buildPollOptionStats";

const UNKNOWN_OPTION_MARKER = "__already_voted__";

type VotedOptions = Record<string, string>;

function createVoterId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `voter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeVotedOptions(raw: Record<string, string> | undefined): VotedOptions {
  if (!raw) {
    return {};
  }
  const normalized: VotedOptions = {};
  for (const [pollId, optionId] of Object.entries(raw)) {
    const trimmedPollId = pollId.trim();
    const trimmedOptionId = optionId.trim();
    if (!trimmedPollId || !trimmedOptionId) {
      continue;
    }
    normalized[trimmedPollId] = trimmedOptionId;
  }
  return normalized;
}

function toFallbackResult(poll: Poll): PollResult {
  return {
    id: poll.id,
    title: poll.title,
    locale: poll.locale,
    defaultLocale: poll.defaultLocale,
    isActive: poll.isActive,
    options: poll.options.map((option) => ({ ...option, votes: 0 })),
    totalVotes: 0,
    createdAt: poll.createdAt,
  };
}

export function Polls() {
  const { t, language } = useTranslation();
  const { toasts, addToast, removeToast } = useToast();
  const voterIdRef = useRef<string | null>(null);
  const votedOptionsRef = useRef<VotedOptions>({});
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResult>>({});
  const [votedOptions, setVotedOptions] = useState<VotedOptions>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingPollId, setSubmittingPollId] = useState<string | null>(null);

  const resolvePollErrorMessage = useCallback(
    (
      error: unknown,
      fallbackKey:
        | "polls.loadFailed"
        | "polls.voteFailed"
        | "polls.resultRefreshFailed",
    ) => {
      if (isPollApiError(error)) {
        switch (error.code) {
          case "ACCESS_DENIED":
            return t("polls.accessDenied");
          case "NETWORK_ERROR":
            return t("polls.networkError");
          case "RATE_LIMITED":
            return t("polls.rateLimited");
          case "SERVER_ERROR":
            return t("polls.serverError");
          case "POLL_NOT_FOUND":
          case "NOT_FOUND":
            return t("polls.pollNotFound");
          case "POLL_INACTIVE":
            return t("polls.pollInactive");
          case "INVALID_OPTION":
            return t("polls.invalidOption");
          default:
            return t(fallbackKey);
        }
      }
      return t(fallbackKey);
    },
    [t],
  );

  const markPollAsVoted = useCallback(async (pollId: string, optionId: string) => {
    const previous = votedOptionsRef.current;
    if (previous[pollId] === optionId) {
      return;
    }

    const nextVotes = { ...previous, [pollId]: optionId } as VotedOptions;
    votedOptionsRef.current = nextVotes;
    setVotedOptions(nextVotes);

    const voterId = voterIdRef.current ?? createVoterId();
    voterIdRef.current = voterId;
    try {
      await savePollClientState({
        voterId,
        votedOptions: nextVotes,
      });
    } catch {
      // Ignore persistence failures here to avoid blocking vote UX.
    }
  }, []);

  const loadPageData = useCallback(async () => {
    const pollList = await fetchPolls(language);
    const resultEntries = await Promise.all(
      pollList.map(async (poll) => {
        try {
          const result = await fetchPollResults(poll.id, language);
          return [poll.id, result] as const;
        } catch {
          return [poll.id, toFallbackResult(poll)] as const;
        }
      }),
    );

    return {
      pollList,
      resultById: Object.fromEntries(resultEntries) as Record<string, PollResult>,
    };
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      try {
        const [clientState, pageData] = await Promise.all([
          getPollClientState(),
          loadPageData(),
        ]);
        if (cancelled) {
          return;
        }
        const normalizedVotes = normalizeVotedOptions(clientState.votedOptions);
        const normalizedVoterId = clientState.voterId?.trim();
        const voterId = normalizedVoterId || createVoterId();

        voterIdRef.current = voterId;
        votedOptionsRef.current = normalizedVotes;
        setVotedOptions(normalizedVotes);

        if (
          voterId !== normalizedVoterId ||
          JSON.stringify(normalizedVotes) !==
            JSON.stringify(clientState.votedOptions ?? {})
        ) {
          void savePollClientState({
            voterId,
            votedOptions: normalizedVotes,
          }).catch(() => undefined);
        }

        setPolls(pageData.pollList);
        setPollResults(pageData.resultById);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPolls([]);
        setPollResults({});
        addToast(resolvePollErrorMessage(error, "polls.loadFailed"), "error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [addToast, loadPageData, resolvePollErrorMessage]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { pollList, resultById } = await loadPageData();
      setPolls(pollList);
      setPollResults(resultById);
      addToast(t("common.refreshSuccess"), "success");
    } catch (error) {
      addToast(resolvePollErrorMessage(error, "polls.loadFailed"), "error");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, loadPageData, resolvePollErrorMessage, t]);

  const handleVote = useCallback(
    async (pollId: string, optionId: string) => {
      if (votedOptionsRef.current[pollId] || submittingPollId === pollId) {
        return;
      }

      setSubmittingPollId(pollId);
      let shouldRefreshResults = false;
      try {
        try {
          const voterId = voterIdRef.current ?? createVoterId();
          voterIdRef.current = voterId;
          await submitPollVote(pollId, {
            voterId,
            optionId,
          });
          await markPollAsVoted(pollId, optionId);
          addToast(t("polls.voteSuccess"), "success");
          shouldRefreshResults = true;
        } catch (error) {
          if (isPollApiError(error) && error.code === "ALREADY_VOTED") {
            await markPollAsVoted(pollId, UNKNOWN_OPTION_MARKER);
            addToast(t("polls.alreadyVoted"), "info");
            shouldRefreshResults = true;
          } else {
            addToast(resolvePollErrorMessage(error, "polls.voteFailed"), "error");
            return;
          }
        }

        if (!shouldRefreshResults) {
          return;
        }

        try {
          const latestResult = await fetchPollResults(pollId, language);
          setPollResults((previous) => ({
            ...previous,
            [pollId]: latestResult,
          }));
        } catch (error) {
          addToast(
            resolvePollErrorMessage(error, "polls.resultRefreshFailed"),
            "error",
          );
        }
      } finally {
        setSubmittingPollId(null);
      }
    },
    [
      addToast,
      language,
      markPollAsVoted,
      resolvePollErrorMessage,
      submittingPollId,
      t,
    ],
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--background)",
      }}
    >
      <PageHeader
        title={t("polls.title")}
        actions={<RefreshButton onClick={handleRefresh} loading={refreshing} />}
      />
      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: "32px",
        }}
      >
        <div style={{ maxWidth: "860px" }}>
          <p
            style={{
              margin: "0 0 20px 0",
              fontSize: "14px",
              lineHeight: 1.7,
              color: "var(--muted-foreground)",
            }}
          >
            {t("polls.description")}
          </p>

          {loading ? (
            <PageLoader message={t("polls.loading")} />
          ) : polls.length === 0 ? (
            <div
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--secondary)",
                borderRadius: "12px",
                padding: "24px",
                color: "var(--muted-foreground)",
                fontSize: "14px",
              }}
            >
              {t("polls.empty")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {polls.map((poll) => {
                const result = pollResults[poll.id] ?? toFallbackResult(poll);
                const stats = buildPollOptionStats(result.options);
                const votedOptionId = votedOptions[poll.id];
                const hasVoted = Boolean(votedOptionId);
                const isSubmitting = submittingPollId === poll.id;

                return (
                  <section
                    key={poll.id}
                    style={{
                      backgroundColor: "var(--secondary)",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      padding: "18px 20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--foreground)",
                          lineHeight: 1.6,
                        }}
                      >
                        {poll.title}
                      </h2>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: "12px",
                          color: "var(--muted-foreground)",
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "999px",
                          padding: "4px 10px",
                          lineHeight: 1,
                        }}
                      >
                        {t("polls.totalVotes").replace(
                          "{count}",
                          String(result.totalVotes),
                        )}
                      </span>
                    </div>

                    {votedOptionId === UNKNOWN_OPTION_MARKER && (
                      <p
                        style={{
                          margin: "0 0 10px 0",
                          fontSize: "12px",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {t("polls.alreadyVotedHint")}
                      </p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {stats.map((option) => {
                        const isSelected = votedOptionId === option.id;
                        const disabled = hasVoted || isSubmitting;
                        const progressWidth = `${Math.max(option.percentage, 0)}%`;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleVote(poll.id, option.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "11px 12px",
                              border: "1px solid var(--border)",
                              borderRadius: "10px",
                              backgroundColor: isSelected
                                ? "var(--sidebar-accent)"
                                : "var(--background)",
                              color: "var(--foreground)",
                              cursor: disabled ? "default" : "pointer",
                              opacity: isSubmitting ? 0.75 : 1,
                              transition: "background-color 0.15s, border-color 0.15s",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "10px",
                                marginBottom: "7px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: isSelected ? 600 : 500,
                                  lineHeight: 1.5,
                                }}
                              >
                                {option.label}
                              </span>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--muted-foreground)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {option.percentage}% ·{" "}
                                {t("polls.votesCount").replace(
                                  "{count}",
                                  String(option.votes),
                                )}
                              </span>
                            </div>
                            <div
                              style={{
                                height: "6px",
                                borderRadius: "999px",
                                backgroundColor: "var(--muted)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: progressWidth,
                                  height: "100%",
                                  borderRadius: "999px",
                                  backgroundColor: option.isLeading
                                    ? "var(--primary)"
                                    : "var(--muted-foreground)",
                                  opacity: option.isLeading ? 1 : 0.5,
                                  transition: "width 0.25s ease",
                                }}
                              />
                            </div>
                            {isSelected && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  color: "var(--primary)",
                                }}
                              >
                                {t("polls.votedTag")}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
