import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { scaleLinear } from 'd3';
import axios from 'axios';
import api from '../api/compounds';
import styles from './AskPanel.module.css';
import dashboard from './Dashboard.module.css';

const examples = [
  'How many antifungals are there?',
  'Show the three strongest binders.',
  'What is the mean solubility by category?',
  'Find compounds under 200 g/mol with toxicity below 2.',
  'How many compounds are in each category?',
  'Which five compounds have the highest molecular weight?',
];

type Cell = string | number | boolean | null;
type Result = {
  status: 'ok';
  sql: string;
  explanation: string;
  columns: string[];
  rows: Cell[][];
  row_count: number;
  truncated: boolean;
  latency_ms: number;
  model: string | null;
  cached?: boolean;
};
type Problem = { status: 'refuse' | 'error' | 'paused' | 'capacity'; reason: string };
type Reply = Result | Problem;

const fallback: Problem = { status: 'error', reason: "We couldn't run your question. Please try again." };

function readProblem(data: unknown): Problem {
  if (!data || typeof data !== 'object' || !('status' in data) || !('reason' in data)) return fallback;
  const { status, reason } = data;
  if ((status === 'refuse' || status === 'error' || status === 'paused' || status === 'capacity')
      && typeof reason === 'string') return { status, reason };
  return fallback;
}

function ResultChart({ result }: { result: Result }) {
  if (result.columns.length !== 2 || !result.rows.length) return null;
  const categoryIndex = result.rows[0].findIndex(cell => typeof cell === 'string');
  if (categoryIndex < 0) return null;
  const numericIndex = 1 - categoryIndex;
  if (!result.rows.every(row => typeof row[categoryIndex] === 'string'
    && typeof row[numericIndex] === 'number' && Number.isFinite(row[numericIndex]))) return null;
  const values = result.rows.map(row => Number(row[numericIndex]));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const x = scaleLinear().domain([min, max || (min === 0 ? 1 : 0)]).range([0, 100]);
  return (
    <section className={styles.chart}>
      <h3>{result.columns[numericIndex]} by {result.columns[categoryIndex]}</h3>
      <div className={styles.bars} role="region" aria-label="Bar chart" tabIndex={0}>
        {result.rows.map((row, index) => {
          const value = values[index];
          const label = String(row[categoryIndex]);
          return (
            <div key={index} className={styles.barRow} aria-hidden="true">
              <span title={label}>{label}</span>
              <svg viewBox="0 0 100 12" preserveAspectRatio="none">
                <rect x={Math.min(x(0), x(value))} y="0" width={Math.abs(x(value) - x(0))} height="12" />
              </svg>
              <span>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QueryResult({ result }: { result: Result }) {
  const [sort, setSort] = useState<{ column: number; descending: boolean }>();
  const [copy, setCopy] = useState('');
  const rows = [...result.rows];
  if (sort) {
    rows.sort((left, right) => {
      const a = left[sort.column];
      const b = right[sort.column];
      if (a === null || b === null) return Number(a === null) - Number(b === null);
      const order = typeof a === 'number' && typeof b === 'number'
        ? a - b : String(a).localeCompare(String(b));
      return sort.descending ? -order : order;
    });
  }
  return (
    <section className={styles.card} aria-label="Query result">
      <div className={styles.line}>
        <h2>Generated SQL</h2>
        <button type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(result.sql);
            setCopy('Copied');
          } catch {
            setCopy('Select the SQL to copy it.');
          }
        }}>Copy SQL</button>
      </div>
      <p className={styles.muted} role="status">{copy}</p>
      <pre tabIndex={0}><code>{result.sql}</code></pre>
      <h3>What the query does</h3>
      <p>{result.explanation}</p>
      <p className={styles.muted}>The AI explanation describes the query only.</p>
      <ResultChart result={result} />
      <div className={styles.line}>
        <h2>Results</h2>
        <p>Showing {result.row_count} {result.row_count === 1 ? 'row' : 'rows'}</p>
      </div>
      {result.truncated && <p className={styles.muted}>Results truncated to 200 rows.</p>}
      <div className={styles.table} role="region" aria-label="Query results table" tabIndex={0}>
        <table>
          <thead><tr>{result.columns.map((column, index) => (
            <th key={index} scope="col" aria-sort={sort?.column === index
              ? sort.descending ? 'descending' : 'ascending' : undefined}>
              <button type="button" onClick={() => setSort({
                column: index, descending: sort?.column === index && !sort.descending,
              })}>
                {column} <span aria-hidden="true">{sort?.column === index ? sort.descending ? '↓' : '↑' : '↕'}</span>
              </button>
            </th>
          ))}</tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={index}>{row.map((cell, i) => <td key={i}>{cell === null ? '—' : String(cell)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      {rows.length === 0 && <p>No rows matched this query.</p>}
      <p className={styles.muted}>{result.cached ? 'Cached result' : `${result.latency_ms} ms`}{result.model && ` · ${result.model}`}</p>
    </section>
  );
}

export default function AskPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<Reply>();
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState(0);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setReply(undefined);
    setRequest(value => value + 1);
    try {
      const { data } = await api.post<Reply>('/api/ask', { question: question.trim() }, { timeout: 30000 });
      setReply(data?.status === 'ok' ? data : readProblem(data));
    } catch (error) {
      setReply(axios.isAxiosError(error) ? readProblem(error.response?.data) : fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`${dashboard.shell} ${styles.shell}`}>
      <div className={styles.layout}>
        <nav aria-label="Dashboard"><a href="#">← Compound explorer</a></nav>
        <section className={styles.card}>
          <h1>Ask the Data</h1>
          <p className={styles.muted}>Demo on a synthetic dataset. The AI can be wrong: check the SQL.</p>
          <form onSubmit={run} className={styles.form}>
            <label htmlFor="ask-question">Your question</label>
            <div className={styles.controls}>
              <input id="ask-question" ref={input} value={question} maxLength={300}
                onChange={event => setQuestion(event.target.value)}
                placeholder="Ask about the compound library…" required />
              <button type="submit" className={styles.run} disabled={loading || !question.trim()}>
                {loading ? 'Running…' : 'Run'}
              </button>
            </div>
          </form>
          <div className={styles.examples} aria-label="Example questions">
            {examples.map(example => <button key={example} type="button" onClick={() => {
              setQuestion(example);
              input.current?.focus();
            }}>{example}</button>)}
          </div>
        </section>
        <div className={styles.muted} role="status">
          {loading ? 'Generating and checking the query…' : reply?.status === 'ok' ? 'Query complete.' : ''}
        </div>
        {reply?.status === 'ok' && <QueryResult key={request} result={reply} />}
        {reply && reply.status !== 'ok' && (
          <section className={styles.card} role="alert">
            <h2>{{
              refuse: 'Question refused', error: 'Question could not run',
              capacity: 'Demo capacity used up', paused: 'Ask the Data is paused',
            }[reply.status]}</h2>
            <p>{reply.status === 'refuse' && <strong>Why was this refused? </strong>}{reply.reason}</p>
          </section>
        )}
      </div>
    </main>
  );
}
