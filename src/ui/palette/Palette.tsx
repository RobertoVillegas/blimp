import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PaletteIntent, UpdateStatus } from '@/shared/messages';
import { send } from '@/shared/send';
import type { AiStatus, NowPlaying, PageAnswer, ProfileSummary, TabSummary, TidyResult, UndoResult } from '@/shared/types';
import { domainOf } from '@/shared/url';
import { COMMANDS, FEATURE_OF, matches, titleRank, type CommandId, type PaletteCommand } from './commands';
import { byUsage, emptyRank, promotePicks, type RankData } from '@/features/ranking/score';
import { CrossTabView } from './CrossTabView';
import { Footer, statusFor } from './Footer';
import { InstantLinksView } from './InstantLinksView';
import { RenameTabView, TabTitlesView } from './TabTitlesView';
import { togglePictureInPicture } from '@/features/pip/page';
import { markdownLink, markdownQuote } from '@/features/copy/format';
import { showQuoteOnPage } from '@/features/ask-page/find-in-page';
import { normalizeForMatch } from '@/shared/quotes';
import { NowPlayingCard } from './NowPlayingCard';
import { PeekView } from './PeekView';
import { AskAiView } from './AskAiView';
import { BrowseView } from './BrowseView';
import { ArchiveView } from './ArchiveView';
import { LiveFoldersView } from './LiveFoldersView';
import { RecentPagesView } from './RecentPagesView';
import { RichText } from './RichText';

export interface PaletteProps {
  /** Popup palette passes the window/tab it was opened for; the overlay lets the background use the sender tab. */
  windowId?: number;
  tabId?: number;
  intent?: PaletteIntent;
  onClose: () => void;
  /** The in-page palette knows its page and the text selected when it opened. */
  page?: { title: string; url: string };
  selection?: string;
  /** Only the in-page palette can capture its page. */
  onCapture?: () => void;
}

type Item =
  | { kind: 'command'; command: PaletteCommand }
  | { kind: 'profile'; profile: ProfileSummary }
  | { kind: 'tab'; tab: TabSummary }
  | { kind: 'instant'; query: string }
  | { kind: 'ask'; query: string }
  | { kind: 'browse'; query: string }
  | { kind: 'update'; version: string }
  | { kind: 'live-new'; count: number };

type View =
  | { name: 'list' }
  | { name: 'running'; label: string; opId?: string }
  | { name: 'tidy-done'; result: TidyResult }
  | { name: 'undo-done'; result: UndoResult }
  | { name: 'page'; turns: { question: string | null; answer: PageAnswer }[]; pending?: string | null }
  | { name: 'cross'; mode: 'summarize' | 'ask' }
  | { name: 'instant'; query: string }
  | { name: 'titles' }
  | { name: 'titles-restored'; count: number }
  | { name: 'peek'; kind: 'gmail' | 'calendar' }
  | { name: 'copied'; what: string }
  | { name: 'ask'; question: string }
  | { name: 'browse'; query: string }
  | { name: 'archive' }
  | { name: 'live' }
  | { name: 'recent' }
  | { name: 'rename' }
  | { name: 'error'; message: string; retry?: () => void };

const AI_COMMANDS = new Set<CommandId>(['tidy', 'tidy-titles', 'summarize-page', 'ask-page', 'summarize-tabs', 'ask-tabs', 'browse']);

export function Palette({ windowId, tabId, intent, onClose, page, selection, onCapture }: PaletteProps) {
  const [query, setQuery] = useState('');
  const [tabs, setTabs] = useState<TabSummary[]>([]);
  const [status, setStatus] = useState<AiStatus>();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [update, setUpdate] = useState<UpdateStatus['update']>(null);
  const [playing, setPlaying] = useState<NowPlaying[]>([]);
  const [inLittle, setInLittle] = useState(false);
  const [rank, setRank] = useState<RankData>(emptyRank);
  const [liveNew, setLiveNew] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<View>({ name: 'list' });
  const [followUp, setFollowUp] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const startedIntent = useRef(false);

  const refreshMedia = useCallback(() => {
    void send({ type: 'media/list', tabId }).then(setPlaying).catch(() => setPlaying([]));
  }, [tabId]);

  const refresh = useCallback(() => {
    void send({ type: 'tabs/list', windowId }).then(setTabs).catch(() => setTabs([]));
    void send({ type: 'ai/status' }).then(setStatus).catch(() => undefined);
    void send({ type: 'profiles/list' }).then(setProfiles).catch(() => setProfiles([]));
    void send({ type: 'update/status' }).then((status) => setUpdate(status.update)).catch(() => setUpdate(null));
    refreshMedia();
    void send({ type: 'little/status', tabId }).then((status) => setInLittle(status.inLittle)).catch(() => setInLittle(false));
    void send({ type: 'tidy/can-undo' }).then(setCanUndo).catch(() => setCanUndo(false));
    void send({ type: 'rank/get' }).then(setRank).catch(() => undefined);
    void send({ type: 'live/list' })
      .then((folders) => setLiveNew(folders.reduce((sum, folder) => sum + folder.unread, 0)))
      .catch(() => setLiveNew(0));
  }, [windowId, refreshMedia]);

  useEffect(refresh, [refresh]);

  const items = useMemo<Item[]>(() => {
    const now = Date.now();
    const available = COMMANDS.filter((command) => command.id !== 'little-to-main' || inLittle);
    const commands = (query ? available : byUsage(available, rank, now))
      .filter((command) => matches(query, command.title, command.keywords, command.description))
      // In a Little Blimp window, keeping the page is the likeliest command.
      .sort((a, b) => (inLittle ? Number(b.id === 'little-to-main') - Number(a.id === 'little-to-main') : 0))
      // Stable sort: list order breaks ties.
      .sort((a, b) => titleRank(query, a.title) - titleRank(query, b.title))
      .map((command): Item => ({ kind: 'command', command }));
    // Profiles only show up when asked for, so the default list stays commands + tabs.
    const profileItems = query
      ? profiles
          .filter((profile) => matches(query, 'profile switch use model ai', profile.name, profile.model))
          .map((profile): Item => ({ kind: 'profile', profile }))
      : [];
    // Like Arc: with nothing typed, the tabs you used most recently come first.
    const tabItems = (query ? tabs.filter((tab) => matches(query, tab.title, tab.url)) : [...tabs].filter((tab) => !tab.active).sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)))
      .slice(0, query ? 30 : 5)
      .map((tab): Item => ({ kind: 'tab', tab }));
    // Any typed text can become an Instant Links search.
    const instant: Item[] = query.trim()
      ? [
          { kind: 'instant', query: query.trim() },
          { kind: 'ask', query: query.trim() },
          { kind: 'browse', query: query.trim() },
        ]
      : [];
    // The notice bar covers the empty list; the row is for people who search for it.
    const updateItem: Item[] =
      update && query && matches(query, 'update upgrade new version release', update.version)
        ? [{ kind: 'update', version: update.version }]
        : [];
    if (!query) {
      const live: Item[] = liveNew ? [{ kind: 'live-new', count: liveNew }] : [];
      return [...tabItems, ...live, ...commands];
    }
    // What the user picked before for this query goes first.
    return promotePicks([...commands, ...profileItems, ...tabItems, ...instant, ...updateItem], rankKey, rank, query, now);
  }, [profiles, query, tabs, update, inLittle, rank, liveNew]);

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
    (command: PaletteCommand, argument?: string) => {
      if (isDisabled(command)) return;
      const effective = statusFor(status, FEATURE_OF[command.id]);
      if (AI_COMMANDS.has(command.id) && effective && !effective.configured) {
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
        case 'summarize-tabs':
          return setView({ name: 'cross', mode: 'summarize' });
        case 'ask-tabs':
          return setView({ name: 'cross', mode: 'ask' });
        case 'tidy-titles':
          return setView({ name: 'titles' });
        case 'rename-tab':
          return setView({ name: 'rename' });
        case 'restore-titles':
          setView({ name: 'running', label: 'Restoring titles…' });
          void send({ type: 'titles/restore', tabIds: tabs.map((tab) => tab.id).concat(tabId ?? []) })
            .then((count) => setView({ name: 'titles-restored', count }))
            .catch((error: unknown) => fail(error));
          return;
        case 'pip':
          // Must start synchronously inside this key press or click.
          if (windowId !== undefined) {
            fail(new Error('Open the palette on the page with the video (⌘K there) to use picture in picture.'));
            return;
          }
          togglePictureInPicture()
            .then(onClose)
            .catch((error: unknown) => fail(error));
          return;
        case 'copy-url':
        case 'copy-markdown':
        case 'copy-quote': {
          // The popup palette works on a tab elsewhere; it can't see that page's selection.
          const target = page ?? tabs.find((tab) => tab.id === tabId);
          if (!target?.url) {
            fail(new Error('No page to copy from.'));
            return;
          }
          if (command.id === 'copy-quote' && !selection) {
            fail(new Error('Select some text on the page first, then open the palette and run Copy as Quote.'));
            return;
          }
          const text =
            command.id === 'copy-url'
              ? target.url
              : command.id === 'copy-markdown'
                ? markdownLink(target.title, target.url)
                : markdownQuote(selection!, target.title, target.url);
          // Inside this key press or click, which clipboard access requires.
          navigator.clipboard
            .writeText(text)
            .then(() => {
              setView({ name: 'copied', what: command.title.replace(/^Copy /, '') });
              setTimeout(onClose, 700);
            })
            .catch(() => fail(new Error('The browser did not allow copying to the clipboard.')));
          return;
        }
        case 'peek-gmail':
          return setView({ name: 'peek', kind: 'gmail' });
        case 'peek-calendar':
          return setView({ name: 'peek', kind: 'calendar' });
        case 'media-toggle': {
          const target = playing.find((item) => item.playing) ?? playing[0];
          if (!target) {
            fail(new Error('Nothing is playing in this window or any other.'));
            return;
          }
          if (!target.controllable) {
            fail(new Error(`Blimp needs access to ${target.accessOrigin?.replace(/^https?:\/\//, '').replace(/\/\*$/, '') ?? 'that site'} to control it. Use Allow control in the palette's Now playing card.`));
            return;
          }
          void send({ type: 'media/action', tabId: target.tabId, action: 'toggle' }).then(onClose);
          return;
        }
        case 'archive':
          return setView({ name: 'archive' });
        case 'live':
          return setView({ name: 'live' });
        case 'recent':
          return setView({ name: 'recent' });
        case 'capture':
          if (!onCapture) {
            fail(new Error('Open the palette on the page you want to capture (⌘K there).'));
            return;
          }
          onClose();
          onCapture();
          return;
        case 'little-new':
          void send({ type: 'little/open' }).then(onClose).catch((error: unknown) => fail(error));
          return;
        case 'little-to-main':
          void send({ type: 'little/to-main', tabId }).then(onClose).catch((error: unknown) => fail(error));
          return;
        case 'little-close':
          void send({ type: 'little/close-all' }).then(onClose).catch((error: unknown) => fail(error));
          return;
        case 'browse':
          return setView({ name: 'browse', query: argument ?? '' });
        case 'instant-links':
          return setView({ name: 'instant', query: '' });
        case 'settings':
          void send({ type: 'settings/open' });
          return onClose();
      }
    },
    [askPage, isDisabled, onClose, runTidy, runUndo, status, tabs, tabId, playing, page, selection, onCapture],
  );

  useEffect(() => {
    if (intent === 'tidy' && status && !startedIntent.current) {
      startedIntent.current = true;
      runCommand(COMMANDS.find((command) => command.id === 'tidy')!);
    }
  }, [intent, runCommand, status]);

  const activate = (item: Item | undefined) => {
    if (!item) return;
    const key = rankKey(item);
    if (key) void send({ type: 'rank/record', key, command: item.kind === 'command' ? item.command.id : undefined, query: query || undefined }).catch(() => undefined);
    if (item.kind === 'live-new') return setView({ name: 'live' });
    if (item.kind === 'command') return runCommand(item.command);
    if (item.kind === 'instant') return setView({ name: 'instant', query: item.query });
    if (item.kind === 'ask') return askAi(item.query);
    if (item.kind === 'browse') return runCommand(COMMANDS.find((command) => command.id === 'browse')!, item.query);
    if (item.kind === 'update') return void send({ type: 'update/show' }).then(onClose);
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

  const askAi = (question: string) => {
    const effective = statusFor(status, 'ask');
    if (effective && !effective.configured) {
      void send({ type: 'settings/open' });
      onClose();
      return;
    }
    setView({ name: 'ask', question });
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
    // Buttons (like the media controls) handle their own Enter and Space.
    if ((event.target as HTMLElement).tagName === 'BUTTON') return;
    // Like Arc's command bar: type anything and press Tab to ask.
    if (event.key === 'Tab' && !event.shiftKey && query.trim()) {
      event.preventDefault();
      askAi(query.trim());
      return;
    }
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
    <div className="hm-palette" role="dialog" aria-modal="true" aria-label="Blimp" onKeyDown={onKeyDown}>
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
          {update && !query && (
            <div className="hm-update-bar" role="status">
              <span>
                <strong>Blimp {update.version} is available.</strong> Updating is recommended.
              </span>
              <button className="hm-link" onClick={() => void send({ type: 'update/show' }).then(onClose)}>
                How to update
              </button>
            </div>
          )}
          {playing.length > 0 && !query && <NowPlayingCard items={playing} onChange={refreshMedia} onClose={onClose} />}
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
                <span className="hm-muted">
                  {' '}
                  · {group.existing ? `${tabsLabel(group.tabCount)} added to your group` : tabsLabel(group.tabCount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="hm-muted">
            {view.result.ungroupedCount ? `${tabsLabel(view.result.ungroupedCount)} left ungrouped` : 'Every tab found a group'}
            {view.result.skippedCount ? `, ${view.result.skippedCount} skipped because they changed meanwhile` : ''}.
          </p>
          <button className="hm-button" autoFocus onClick={() => void runUndo()}>
            Undo Tidy Tabs
          </button>
        </ResultPanel>
      )}

      {view.name === 'undo-done' && (
        <ResultPanel title="Tidy Tabs undone" onBack={backToList}>
          <p>{tabsLabel(view.result.restoredCount)} restored.</p>
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
                <RichText
                  text={turn.answer.text}
                  quote={(text) => {
                    const verified = turn.answer.quotes?.find((q) => normalizeForMatch(q.text) === normalizeForMatch(text))?.found;
                    return (
                      <blockquote className="hm-quote">
                        <span>{text}</span>
                        {verified === false ? (
                          <span className="hm-quote-status hm-warning">Not found on the page; treat it as a paraphrase</span>
                        ) : page ? (
                          <button
                            className="hm-link hm-quote-status"
                            onClick={() => {
                              onClose();
                              // After the palette is gone, so the selection and scroll stick.
                              requestAnimationFrame(() => showQuoteOnPage(text));
                            }}
                          >
                            Show on page
                          </button>
                        ) : (
                          <span className="hm-quote-status hm-muted">On the page</span>
                        )}
                      </blockquote>
                    );
                  }}
                />
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

      {view.name === 'cross' && (
        <CrossTabView mode={view.mode} windowId={windowId} tabId={tabId} status={statusFor(status, 'tabs')} onBack={backToList} onClose={onClose} />
      )}

      {view.name === 'recent' && <RecentPagesView tabId={tabId} onBack={backToList} onClose={onClose} />}

      {view.name === 'live' && <LiveFoldersView tabId={tabId} onBack={backToList} onClose={onClose} />}

      {view.name === 'archive' && <ArchiveView tabId={tabId} onBack={backToList} onClose={onClose} />}

      {view.name === 'browse' && (
        <BrowseView initialQuery={view.query} tabId={tabId} status={statusFor(status, 'ask')} onBack={backToList} onClose={onClose} />
      )}

      {view.name === 'ask' && <AskAiView question={view.question} status={statusFor(status, 'ask')} onBack={backToList} />}

      {view.name === 'copied' && (
        <div className="hm-panel" role="status">
          <p>Copied {view.what.toLowerCase()}.</p>
        </div>
      )}

      {view.name === 'peek' && <PeekView kind={view.kind} onBack={backToList} onClose={onClose} />}

      {view.name === 'titles-restored' && (
        <ResultPanel title="Tab titles restored" onBack={backToList}>
          <p>{view.count ? `${tabsLabel(view.count)} got their site's title back.` : 'No tab in this window had a name from Blimp.'}</p>
        </ResultPanel>
      )}

      {view.name === 'titles' && <TabTitlesView windowId={windowId} status={statusFor(status, 'tidy')} onBack={backToList} />}

      {view.name === 'rename' && <RenameTabView tabId={tabId} onBack={backToList} onClose={onClose} />}

      {view.name === 'instant' && (
        <InstantLinksView initialQuery={view.query} tabId={tabId} status={statusFor(status, 'instant')} onBack={backToList} onClose={onClose} />
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

function tabsLabel(count: number): string {
  return `${count} ${count === 1 ? 'tab' : 'tabs'}`;
}

/** Stable key for learning picks; null for rows that only exist for this query. */
function rankKey(item: Item): string | null {
  if (item.kind === 'command') return `cmd:${item.command.id}`;
  if (item.kind === 'tab') return `tab:${item.tab.url.split('#')[0]}`;
  if (item.kind === 'profile') return `profile:${item.profile.id}`;
  return null;
}

function itemKey(item: Item): string {
  if (item.kind === 'command') return item.command.id;
  if (item.kind === 'profile') return `profile-${item.profile.id}`;
  if (item.kind === 'instant') return 'instant';
  if (item.kind === 'ask') return 'ask';
  if (item.kind === 'browse') return 'browse';
  if (item.kind === 'update') return 'update';
  if (item.kind === 'live-new') return 'live-new';
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
      {item.kind === 'live-new' ? (
        <>
          <span className="hm-icon" aria-hidden="true">
            ◉
          </span>
          <span className="hm-item-title">Live Folders</span>
          <span className="hm-item-hint">
            <span className="hm-badge">{item.count} new</span>
          </span>
        </>
      ) : item.kind === 'browse' ? (
        <>
          <span className="hm-icon" aria-hidden="true">
            ✧
          </span>
          <span className="hm-item-title">Browse for Me: “{item.query}”</span>
          <span className="hm-item-hint">Search and read</span>
        </>
      ) : item.kind === 'ask' ? (
        <>
          <span className="hm-icon" aria-hidden="true">
            ✦
          </span>
          <span className="hm-item-title">Ask AI: “{item.query}”</span>
          <span className="hm-item-hint">Tab</span>
        </>
      ) : item.kind === 'update' ? (
        <>
          <span className="hm-icon" aria-hidden="true">
            ↑
          </span>
          <span className="hm-item-title">Blimp {item.version} is available</span>
          <span className="hm-item-hint">How to update</span>
        </>
      ) : item.kind === 'instant' ? (
        <>
          <span className="hm-icon" aria-hidden="true">
            ↗
          </span>
          <span className="hm-item-title">Instant Links: “{item.query}”</span>
          <span className="hm-item-hint">Search the web</span>
        </>
      ) : item.kind === 'profile' ? (
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
