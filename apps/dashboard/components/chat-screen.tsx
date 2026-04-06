"use client";

import { useUser } from "@clerk/nextjs";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { getErrorMessage, readJson, sendJson } from "@/lib/api-client";
import { formatTimestamp } from "@/lib/format";
import type { ChatMessage, LLMProviderOption, RegistryEntry, RepoOption } from "@/lib/types";

import { RefreshPill } from "./refresh-pill";

const DEFAULT_AGENT_ID = "role/coordinator";
const DEFAULT_LLM_ID = "anthropic";
const REPO_STORAGE_KEY = "chat_selected_repo";
const AGENT_STORAGE_KEY = "chat_selected_agent";
const LLM_STORAGE_KEY = "chat_selected_llm";

type ChatSnapshot = {
  agents: RegistryEntry[];
  error: string | null;
  isHistoryLoading: boolean;
  isLoadingResources: boolean;
  isSending: boolean;
  lastUpdated: string | null;
  llmProviders: LLMProviderOption[];
  messages: ChatMessage[];
  repos: RepoOption[];
};

const INITIAL_SNAPSHOT: ChatSnapshot = {
  agents: [],
  error: null,
  isHistoryLoading: true,
  isLoadingResources: true,
  isSending: false,
  lastUpdated: null,
  llmProviders: [],
  messages: [],
  repos: []
};

export function ChatScreen() {
  const { isLoaded, user } = useUser();
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(INITIAL_SNAPSHOT);
  const [inputValue, setInputValue] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT_ID);
  const [selectedLlmId, setSelectedLlmId] = useState(DEFAULT_LLM_ID);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const preferencesReadyRef = useRef(false);

  const sessionId = user?.id ?? null;

  useEffect(() => {
    if (preferencesReadyRef.current) {
      return;
    }

    const storedRepo = window.localStorage.getItem(REPO_STORAGE_KEY);
    const storedAgentId = window.localStorage.getItem(AGENT_STORAGE_KEY);
    const storedLlmId = window.localStorage.getItem(LLM_STORAGE_KEY);

    if (storedRepo) {
      setSelectedRepo(storedRepo);
    }

    if (storedAgentId) {
      setSelectedAgentId(storedAgentId);
    }

    if (storedLlmId) {
      setSelectedLlmId(storedLlmId);
    }

    preferencesReadyRef.current = true;
  }, []);

  useEffect(() => {
    if (!preferencesReadyRef.current) {
      return;
    }

    window.localStorage.setItem(REPO_STORAGE_KEY, selectedRepo);
  }, [selectedRepo]);

  useEffect(() => {
    if (!preferencesReadyRef.current) {
      return;
    }

    window.localStorage.setItem(AGENT_STORAGE_KEY, selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    if (!preferencesReadyRef.current) {
      return;
    }

    window.localStorage.setItem(LLM_STORAGE_KEY, selectedLlmId);
  }, [selectedLlmId]);

  const loadResources = useEffectEvent(async () => {
    try {
      const [repos, llmProviders, agents] = await Promise.all([
        readJson<RepoOption[]>("/api/repos"),
        readJson<LLMProviderOption[]>("/api/llm-providers"),
        readJson<RegistryEntry[]>("/api/registry")
      ]);

      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          agents,
          error: null,
          isLoadingResources: false,
          lastUpdated: new Date().toISOString(),
          llmProviders,
          repos
        }));
      });
    } catch (error) {
      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          error: getErrorMessage(error),
          isLoadingResources: false,
          lastUpdated: new Date().toISOString()
        }));
      });
    }
  });

  const loadHistory = useEffectEvent(async (activeSessionId: string) => {
    try {
      const messages = await readJson<ChatMessage[]>(
        `/api/chat/history?sessionId=${encodeURIComponent(activeSessionId)}`
      );

      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          error: null,
          isHistoryLoading: false,
          lastUpdated: new Date().toISOString(),
          messages
        }));
      });
    } catch (error) {
      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          error: getErrorMessage(error),
          isHistoryLoading: false,
          lastUpdated: new Date().toISOString()
        }));
      });
    }
  });

  useEffect(() => {
    void loadResources();
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    setSnapshot((current) => ({
      ...current,
      isHistoryLoading: true
    }));
    void loadHistory(sessionId);
  }, [sessionId]);

  useEffect(() => {
    const element = threadEndRef.current;
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [snapshot.messages, snapshot.isSending]);

  useEffect(() => {
    if (snapshot.repos.length === 0) {
      return;
    }

    const hasSelectedRepo = selectedRepo.length > 0;
    const hasMatchingRepo = snapshot.repos.some((repo) => repo.fullName === selectedRepo);

    if (hasSelectedRepo && hasMatchingRepo) {
      return;
    }

    const defaultRepo =
      snapshot.repos.find((repo) => repo.fullName === "Markus-Beermann/cortex-agentic") ??
      snapshot.repos[0];

    if (defaultRepo) {
      setSelectedRepo(defaultRepo.fullName);
    }
  }, [snapshot.repos, selectedRepo]);

  useEffect(() => {
    if (snapshot.llmProviders.length === 0) {
      return;
    }

    if (snapshot.llmProviders.some((provider) => provider.id === selectedLlmId)) {
      return;
    }

    setSelectedLlmId(snapshot.llmProviders[0]?.id ?? DEFAULT_LLM_ID);
  }, [snapshot.llmProviders, selectedLlmId]);

  useEffect(() => {
    if (snapshot.agents.length === 0) {
      return;
    }

    if (snapshot.agents.some((agent) => agent.id === selectedAgentId)) {
      return;
    }

    setSelectedAgentId(DEFAULT_AGENT_ID);
  }, [snapshot.agents, selectedAgentId]);

  const selectedAgent = useMemo(
    () => snapshot.agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [snapshot.agents, selectedAgentId]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionId || snapshot.isSending) {
      return;
    }

    const message = inputValue.trim();

    if (message.length === 0) {
      return;
    }

    setSnapshot((current) => ({
      ...current,
      error: null,
      isSending: true
    }));
    setInputValue("");

    try {
      const response = await sendJson<{ messageId: number; reply: string }>("/api/chat", "POST", {
        message,
        agentId: selectedAgentId,
        repoId: selectedRepo || undefined,
        llmId: selectedLlmId,
        sessionId
      });

      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          isSending: false,
          lastUpdated: new Date().toISOString(),
          messages: [
            ...current.messages,
            { role: "user", content: message },
            { role: "assistant", content: response.reply }
          ]
        }));
      });
    } catch (error) {
      setInputValue(message);
      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          error: getErrorMessage(error),
          isSending: false
        }));
      });
    }
  }

  return (
    <main className="shell">
      <div className="page-stack">
        <section className="panel hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Debussy Chat</span>
              <h1>Talk to the coordinator without turning the dashboard into a shrine.</h1>
              <p>
                Repo context, agent identity, and LLM choice stay visible. The conversation lives in
                PostgreSQL, not in your browser&apos;s temporary amnesia.
              </p>
            </div>
            <RefreshPill lastUpdated={snapshot.lastUpdated} />
          </div>
        </section>

        <section className="panel panel-content">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Chat</p>
              <h2 className="section-title">
                {selectedAgent ? `${selectedAgent.displayName} online` : "Loading agent"}
              </h2>
              <p className="section-copy">
                Only Debussy is currently active. The others are visible so the future has a seating
                chart, not because they are invited already.
              </p>
            </div>
          </div>

          <div className="chat-toolbar">
            <label className="chat-select-group">
              <span className="meta-label">Repo</span>
              <select
                className="chat-select"
                value={selectedRepo}
                onChange={(event) => setSelectedRepo(event.target.value)}
                disabled={snapshot.isLoadingResources}
              >
                {snapshot.repos.map((repo) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="chat-select-group">
              <span className="meta-label">Role</span>
              <select
                className="chat-select"
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                disabled={snapshot.isLoadingResources}
              >
                {snapshot.agents.map((agent) => (
                  <option
                    key={agent.id}
                    value={agent.id}
                    disabled={agent.id !== DEFAULT_AGENT_ID}
                  >
                    {agent.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="chat-select-group">
              <span className="meta-label">LLM</span>
              <select
                className="chat-select"
                value={selectedLlmId}
                onChange={(event) => setSelectedLlmId(event.target.value)}
                disabled={snapshot.isLoadingResources}
              >
                {snapshot.llmProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {snapshot.error ? (
            <div className="error-banner">Chat error: {snapshot.error}</div>
          ) : null}

          <div className="chat-thread" role="log" aria-live="polite">
            {snapshot.isHistoryLoading ? (
              <div className="empty-state">Loading chat history…</div>
            ) : null}

            {!snapshot.isHistoryLoading && snapshot.messages.length === 0 ? (
              <div className="empty-state">No conversation yet. Debussy is waiting for actual work.</div>
            ) : null}

            {snapshot.messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`chat-message chat-message-${message.role}`}
              >
                <span className="chat-message-role">
                  {message.role === "assistant" ? "Debussy" : "You"}
                </span>
                <p className="chat-message-content">{message.content}</p>
              </article>
            ))}

            {snapshot.isSending ? (
              <article className="chat-message chat-message-assistant chat-message-pending">
                <span className="chat-message-role">Debussy</span>
                <p className="chat-message-content">Thinking. Which is preferable to random output.</p>
              </article>
            ) : null}

            <div ref={threadEndRef} />
          </div>

          <form className="chat-input-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="chat-input-meta">
              <span className="run-card-copy">
                Session {sessionId ?? "loading"} · {selectedRepo || "No repo selected"} · Updated{" "}
                {snapshot.lastUpdated ? formatTimestamp(snapshot.lastUpdated) : "never"}
              </span>
            </div>
            <div className="chat-input-row">
              <textarea
                className="chat-textarea"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask Debussy to plan, critique, or route the next move…"
                rows={4}
                disabled={!isLoaded || !sessionId || snapshot.isSending}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!isLoaded || !sessionId || snapshot.isSending || inputValue.trim().length === 0}
              >
                {snapshot.isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
