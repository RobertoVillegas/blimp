import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { send, type PaletteIntent } from '@/shared/messages';
import type { AiStatus, PageAnswer, ProfileSummary, TabSummary, TidyResult, UndoResult } from '@/shared/types';
import { domainOf } from '@/shared/url';
import { COMMANDS, matches, type CommandId, type PaletteCommand } from './commands';
import { RichText } from './RichText';

export interface PaletteProps {
  /** Popup palette passes the window/tab it was opened for; the overlay lets the background use the sender tab. */
  windowId?: number;
  tabId?: number;
  intent?: PaletteIntent;
  onClose: () => void;
}

type Item =
  | { kind: 'command'; command: PaletteCommand }
  | { kind: 'profile'; profile: ProfileSummary }
  | { kind: 'tab'; tab: TabSummary };

type View =
  | { name: 'list' }
  | { name: 'running'; label: string; opId?: string }
  | { name: 'tidy-done'; result: TidyResult }
  | { name: 'undo-done'; result: UndoResult }
  | { name: 'page'; turns: { question: string | null; answer: PageAnswer }[]; pending?: string | null }
  | { name: 'error'; message: string; retry?: () => void };

const AI_COMMANDS = new Set<CommandId>(['tidy', 'summarize-page', 'ask-page']);

export function Palette({ windowId, tabId, intent, onClose }: PaletteProps) {
  const [query, setQuery] = useState('');
  const [tabs, setTabs] = useState<TabSummary[]>([]);
  const [status, setStatus] = useState<AiStatus>();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<View>({ name: 'list' });
  const [followUp, setFollowUp] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const startedIntent = useRef(false);

  const refresh = useCallback(() => {
    void send({ type: 'tabs/list', windowId }).then(setTabs).catch(() => setTabs([]));
    void send({ type: 'ai/status' }).then(setStatus).catch(() => undefined);
    void send({ type: 'profiles/list' }).then(setProfiles).catch(() => setProfiles([]));
    void send({ type: 'tidy/can-undo' }).then(setCanUndo).catch(() => setCanUndo(false));
  }, [windowId]);

  useEffect(refresh, [refresh]);

  const items = useMemo<Item[]>(() => {
    const commands = COMMANDS.filter((command) =>
      matches(query, command.title, command.keywords, command.description),
    ).map((command): Item => ({ kind: 'command', command }));
    // Profiles only show up when asked for, so the default list stays commands + tabs.
    const profileItems = query
      ? profiles
          .filter((profile) => matches(query, 'profile switch use model ai', profile.name, profile.model))
          .map((profile): Item => ({ kind: 'profile', profile }))
      : [];
    const tabItems = tabs
      .filter((tab) => (query ? matches(query, tab.title, tab.url) : !tab.active))
      .slice(0, query ? 30 : 6)
      .map((tab): Item => ({ kind: 'tab', tab }));
    return [...commands, ...profileItems, ...tabItems];
  }, [profiles, query, tabs]);

  useEffect(() => setSelected(0), [query]);

  const isDisabled = useCallback(
    (command: PaletteCommand) => Boolean(command.milestone) || (command.id === 'undo-tidy' && !canUndo),
    [canUndo],
  );

  const fail = (error: unknown, retry?: () => void) =>
    setView({ name: 'error', message: error instanceof Error ? error.message : String(error), retry });

  const runTidy = useCallback(async () => {
    const opId = crypto.randomUUID();
    setView({ name: 'running', label: 'Tidying tabs…', opId });
    try {
      const result = await send({ type: 'tidy/run', opId, windowId });
      setCanUndo(true);
      setView({ name: 'tidy-done', result });
    } catch (error) {
      fail(error, () => void runTidy());
    }
  }, [windowId]);

  const runUndo = useCallback(async () => {
    setView({ name: 'running', label: 'Restoring tabs…' });
    try {
      const result = await send({ type: 'tidy/undo', windowId });
      setCanUndo(false);
      setView({ name: 'undo-done', result });
    } catch (error) {
      fail(error);
    }
  }, [windowId]);

  const askPage = useCallback(
    async (question: string | null, turns: { question: string | null; answer: PageAnswer }[] = []) => {
      const opId = crypto.randomUUID();
      setView({ name: 'page', turns, pending: question });
      try {
        const answer = await send({ type: 'page/ask', opId, tabId, question });
        setView({ name: 'page', turns: [...turns, { question, answer }] });
      } catch (error) {
        fail(error, () => void askPage(question, turns));
      }
    },
    [tabId],
  );

  const runCommand = useCallback(
    (command: PaletteCommand) => {
      if (isDisabled(command)) return;
      if (AI_COMMANDS.has(command.id) && status && !status.configured) {
        void send({ type: 'settings/open' });
        onClose();
        return;
      }
      switch (command.id) {
        case 'tidy':
          return void runTidy();
        case 'undo-tidy':
          return void runUndo();
        case 'summarize-page':
          return void askPage(null);
        case 'ask-page':
          setFollowUp('');
          return setView({ name: 'page', turns: [] });
        case 'settings':
          void send({ type: 'settings/open' });
          return onClose();
      }
    },
    [askPage, isDisabled, onClose, runTidy, runUndo, status],
  );

  useEffect(() => {
    if (intent === 'tidy' && status && !startedIntent.current) {
      startedIntent.current = true;
      runCommand(COMMANDS.find((command) => command.id === 'tidy')!);
    }
  }, [intent, runCommand, status]);

  const activate = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'command') return runCommand(item.command);
    if (item.kind === 'profile') {
      void send({ type: 'profiles/activate', profileId: item.profile.id })
        .then((next) => {
          setStatus(next);
          setQuery('');
          refresh();
        })
        .catch((error: unknown) => fail(error));
      return;
    }
    void send({ type: 'tabs/activate', tabId: item.tab.id }).then(onClose);
  };

  const backToList = () => {
    setView({ name: 'list' });
    refresh();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (view.name === 'running' && view.opId) void send({ type: 'op/cancel', opId: view.opId });
      if (view.name === 'list') onClose();
      else backToList();
      return;
    }
    if (view.name !== 'list') return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(items[selected]);
    }
  };

  const current = items[selected];
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div className="hm-palette" role="dialog" aria-modal="true" aria-label="Helium Max" onKeyDown={onKeyDown}>
      {view.name === 'list' && (
        <>
          <div className="hm-search">
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commands and tabs…"
              aria-label="Search commands and tabs"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={current ? optionId(selected) : undefined}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <ul className="hm-list" id={listId} role="listbox" aria-label="Results">
            {items.length === 0 && <li className="hm-empty">No commands or tabs match “{query}”.</li>}
            {items.map((item, index) => (
              <ItemRow
                key={itemKey(item)}
                id={optionId(index)}
                item={item}
                selected={index === selected}
                disabled={item.kind === 'command' && isDisabled(item.command)}
                onHover={() => setSelected(index)}
                onClick={() => activate(item)}
              />
            ))}
          </ul>
          <Footer status={status} command={current?.kind === 'command' ? current.command : undefined} />
        </>
      )}

      {view.name === 'running' && (
        <div className="hm-panel" role="status" aria-live="polite">
          <div className="hm-spinner" aria-hidden="true" />
          <p>{view.label}</p>
          {view.opId && (
            <button className="hm-button" onClick={() => void send({ type: 'op/cancel', opId: view.opId! })}>
              Cancel
            </button>
          )}
        </div>
      )}

      {view.name === 'tidy-done' && (
        <ResultPanel title="Tabs tidied" onBack={backToList}>
          <ul className="hm-groups">
            {view.result.groups.map((group) => (
              <li key={group.title}>
                <span className={`hm-dot hm-color-${group.color}`} aria-hidden="true" />
                {group.title}
                <span className="hm-muted"> · {group.tabCount} tabs</span>
              </li>
            ))}
          </ul>
          <p className="hm-muted">
            {view.result.ungroupedCount} tabs left ungrouped
            {view.result.skippedCount ? `, ${view.result.skippedCount} skipped because they changed meanwhile` : ''}.
          </p>
          <button className="hm-button" autoFocus onClick={() => void runUndo()}>
            Undo Tidy Tabs
          </button>
        </ResultPanel>
      )}

      {view.name === 'undo-done' && (
        <ResultPanel title="Tidy Tabs undone" onBack={backToList}>
          <p>{view.result.restoredCount} tabs restored.</p>
          {view.result.conflicts.map((conflict) => (
            <p key={conflict} className="hm-warning">
              {conflict}
            </p>
          ))}
        </ResultPanel>
      )}

      {view.name === 'page' && (
        <div className="hm-page">
          <header className="hm-page-header">
            <button className="hm-link" onClick={backToList} aria-label="Back to commands">
              ←
            </button>
            <span className="hm-page-title">{view.turns[0]?.answer.title ?? 'Ask this page'}</span>
            {view.turns.length > 0 && (
              <button
                className="hm-link"
                onClick={() => {
                  void send({ type: 'page/forget', tabId });
                  setView({ name: 'page', turns: [] });
                }}
              >
                Forget this page conversation
              </button>
            )}
          </header>
          <div className="hm-conversation" aria-live="polite">
            {view.turns.map((turn, index) => (
              <div key={index} className="hm-turn">
                {turn.question && <p className="hm-question">{turn.question}</p>}
                <RichText text={turn.answer.text} />
                {turn.answer.truncated && index === 0 && (
                  <p className="hm-muted">Long page: only the first part was sent.</p>
                )}
              </div>
            ))}
            {view.pending !== undefined && (
              <div className="hm-turn">
                {view.pending && <p className="hm-question">{view.pending}</p>}
                <p className="hm-muted">Reading the page…</p>
              </div>
            )}
          </div>
          <form
            className="hm-ask"
            onSubmit={(event) => {
              event.preventDefault();
              const question = followUp.trim();
              if (!question || view.pending !== undefined) return;
              setFollowUp('');
              void askPage(question, view.turns);
            }}
          >
            <input
              autoFocus
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              placeholder={view.turns.length ? 'Ask a follow-up…' : 'Ask something about this page…'}
              aria-label="Question about this page"
              disabled={view.pending !== undefined}
            />
          </form>
          <Footer status={status} command={COMMANDS.find((command) => command.id === 'ask-page')} />
        </div>
      )}

      {view.name === 'error' && (
        <ResultPanel title="That didn't work" onBack={backToList}>
          <p className="hm-warning" role="alert">
            {view.message}
          </p>
          {view.retry && (
            <button className="hm-button" autoFocus onClick={view.retry}>
              Try again
            </button>
          )}
        </ResultPanel>
      )}
    </div>
  );
}

function itemKey(item: Item): string {
  if (item.kind === 'command') return item.command.id;
  if (item.kind === 'profile') return `profile-${item.profile.id}`;
  return `tab-${item.tab.id}`;
}

function ItemRow({
  id,
  item,
  selected,
  disabled,
  onHover,
  onClick,
}: {
  id: string;
  item: Item;
  selected: boolean;
  disabled: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <li
      ref={ref}
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      className="hm-item"
      onMouseMove={onHover}
      onClick={onClick}
    >
      {item.kind === 'profile' ? (
        <>
          <span className="hm-icon" aria-hidden="true">
            {item.profile.active ? '●' : '○'}
          </span>
          <span className="hm-item-title">Use {item.profile.name}</span>
          <span className="hm-item-hint">{item.profile.active ? 'Active profile' : item.profile.model || 'No model set'}</span>
        </>
      ) : item.kind === 'command' ? (
        <>
          <span className="hm-icon" aria-hidden="true">
            {item.command.icon}
          </span>
          <span className="hm-item-title">{item.command.title}</span>
          <span className="hm-item-hint">{item.command.milestone ? `Coming in ${item.command.milestone}` : 'Command'}</span>
        </>
      ) : (
        <>
          <span className="hm-icon" aria-hidden="true">
            {item.tab.favIconUrl?.startsWith('https:') ? <img src={item.tab.favIconUrl} alt="" /> : '◻'}
          </span>
          <span className="hm-item-title">{item.tab.title || item.tab.url}</span>
          <span className="hm-item-hint">{domainOf(item.tab.url) || 'Tab'}</span>
        </>
      )}
    </li>
  );
}

function Footer({ status, command }: { status?: AiStatus; command?: PaletteCommand }) {
  let note = command?.description ?? 'Enter to run · ↑↓ to move · Esc to close';
  if (command?.sends && status) {
    note = status.configured
      ? status.hosted
        ? `Sends ${command.sends} to ${status.profileName}.`
        : `Uses ${status.profileName}; ${command.sends} stay on this device.`
      : `${status.problem} Enter opens AI Settings.`;
  }
  return (
    <footer className="hm-footer">
      <span className="hm-note">{note}</span>
      {status && (
        <span className="hm-provider" title={status.configured ? undefined : status.problem}>
          {status.configured ? `${status.profileName} · ${status.model}` : `${status.profileName}: not set up`}
        </span>
      )}
    </footer>
  );
}

function ResultPanel({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="hm-panel hm-result">
      <h2>{title}</h2>
      {children}
      <button className="hm-link" onClick={onBack}>
        Back to commands
      </button>
    </div>
  );
}
