import { useEffect, useState, useSyncExternalStore } from 'react';
import Dashboard from './components/Dashboard';
import AskPanel from './components/AskPanel';
import api from './api/compounds';
import askStyles from './components/AskPanel.module.css';
import dashboardStyles from './components/Dashboard.module.css';

const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};

function App() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const [askEnabled, setAskEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api.get<unknown>('/api/ask/status', { signal: controller.signal, timeout: 5000 })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setAskEnabled(typeof data === 'object' && data !== null && 'enabled' in data && data.enabled === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAskEnabled(false);
      });
    return () => controller.abort();
  }, []);

  if (hash !== '#ask') return <Dashboard askEnabled={askEnabled} />;
  if (askEnabled) return <AskPanel />;

  return (
    <main className={`${dashboardStyles.shell} ${askStyles.shell}`}>
      <div className={askStyles.layout}>
        <section className={askStyles.card} aria-labelledby="ask-paused-title">
          <h1 id="ask-paused-title">Ask the Data is paused</h1>
          <p>It will return soon.</p>
          <a href="#">← Back to the explorer</a>
        </section>
      </div>
    </main>
  );
}

export default App;
