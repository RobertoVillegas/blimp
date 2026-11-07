import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './sidepanel.css';

// First piece of the Arc-style sidebar: the window's pinned tabs. Favorites and media controls come next.
function Sidebar() {
  const [tabs, setTabs] = useState<Browser.tabs.Tab[]>([]);

  useEffect(() => {
    const refresh = async () => {
      const window = await browser.windows.getCurrent();
      setTabs(await browser.tabs.query({ windowId: window.id, pinned: true }));
    };
    void refresh();
    const events = [browser.tabs.onUpdated, browser.tabs.onRemoved, browser.tabs.onCreated, browser.tabs.onMoved, browser.tabs.onActivated];
    for (const event of events) event.addListener(refresh);
    return () => {
      for (const event of events) event.removeListener(refresh);
    };
  }, []);

  return (
    <main>
      <h1>Pinned</h1>
      {tabs.length === 0 && <p className="hint">Pin a tab and it shows up here.</p>}
      <ul className="pinned" aria-label="Pinned tabs">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={tab.active ? 'active' : undefined}
              title={tab.title}
              onClick={() => void browser.tabs.update(tab.id!, { active: true })}
            >
              {tab.favIconUrl?.startsWith('https:') ? <img src={tab.favIconUrl} alt="" /> : <span className="dot" aria-hidden="true" />}
              <span>{tab.title || tab.url}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Sidebar />);
