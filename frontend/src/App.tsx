import { useSyncExternalStore } from 'react';
import Dashboard from './components/Dashboard';
import AskPanel from './components/AskPanel';

const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};

function App() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash === '#ask' ? <AskPanel /> : <Dashboard />;
}

export default App;
