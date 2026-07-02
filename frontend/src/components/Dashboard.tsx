import { useEffect, useState, useCallback } from 'react';
import { getCompounds, getStats, getCategories } from '../api/compounds';
import type { Compound, StatsResponse, CompoundFilters } from '../types';
import ScatterPlot from './ScatterPlot';
import BarChart from './BarChart';
import Histogram from './Histogram';
import styles from './Dashboard.module.css';

const visibleRows = 25;

export default function Dashboard() {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<CompoundFilters>({ page: 1, page_size: 100 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compoundsRes, statsRes] = await Promise.all([
        getCompounds(filters),
        getStats(),
      ]);
      setCompounds(compoundsRes.results);
      setStats(statsRes);
    } catch (err) {
      setError('Failed to load data. Is the backend running on port 8000?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const selectedCompound = compounds.find((c) => c.id === selectedId) ?? null;
  const totalCategories = stats?.categories.length ?? categories.length;
  const avgToxicity = compounds.length
    ? compounds.reduce((sum, compound) => sum + compound.toxicity_score, 0) / compounds.length
    : 0;
  const bestAffinity = compounds.length
    ? Math.min(...compounds.map((compound) => compound.binding_affinity))
    : 0;

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Compound intelligence dashboard</span>
          <h1>Scientific Compound Data Explorer</h1>
          <p>
            Explore molecular properties, toxicity bands, and binding affinity patterns across
            the seeded compound library.
          </p>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.molecule}>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.statsGrid} aria-label="Dashboard summary">
        <article className={styles.metric}>
          <span>Total compounds</span>
          <strong>{stats?.total_compounds ?? compounds.length}</strong>
        </article>
        <article className={styles.metric}>
          <span>Categories</span>
          <strong>{totalCategories}</strong>
        </article>
        <article className={styles.metric}>
          <span>Avg toxicity</span>
          <strong>{avgToxicity ? avgToxicity.toFixed(2) : '--'}</strong>
        </article>
        <article className={styles.metric}>
          <span>Best affinity</span>
          <strong>{bestAffinity ? `${bestAffinity.toFixed(2)} nM` : '--'}</strong>
        </article>
      </section>

      <section className={styles.toolbar} aria-label="Compound filters">
        <label>
          Category
          <select
            value={filters.category ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, category: e.target.value || undefined, page: 1 }))
            }
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          Min weight
          <input
            type="number"
            placeholder="0"
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                min_weight: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              }))
            }
          />
        </label>

        <label>
          Max weight
          <input
            type="number"
            placeholder="800"
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                max_weight: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              }))
            }
          />
        </label>
      </section>

      {loading ? (
        <div className={styles.loading}>
          <span />
          Loading dashboard...
        </div>
      ) : (
        <>
          <section className={styles.chartGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span>Relationship map</span>
                  <h2>Molecular Weight vs Toxicity</h2>
                </div>
              </div>
              <ScatterPlot data={compounds} onPointClick={(c) => setSelectedId(c.id)} selectedId={selectedId} />
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span>Category signal</span>
                  <h2>Avg Binding Affinity by Category</h2>
                </div>
              </div>
              {stats && <BarChart data={stats.categories} />}
            </article>
          </section>

          {stats && stats.molecular_weight_distribution.length > 0 && (
            <section className={`${styles.panel} ${styles.widePanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <span>Distribution</span>
                  <h2>Molecular Weight Distribution</h2>
                </div>
              </div>
              <Histogram data={stats.molecular_weight_distribution} />
            </section>
          )}

          {selectedCompound && (
            <section className={styles.selectedPanel}>
              <div>
                <span>Selected compound</span>
                <strong>{selectedCompound.name}</strong>
              </div>
              <dl>
                <div>
                  <dt>Formula</dt>
                  <dd>{selectedCompound.molecular_formula}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{selectedCompound.category}</dd>
                </div>
                <div>
                  <dt>MW</dt>
                  <dd>{selectedCompound.molecular_weight} g/mol</dd>
                </div>
                <div>
                  <dt>Toxicity</dt>
                  <dd>{selectedCompound.toxicity_score}</dd>
                </div>
                <div>
                  <dt>Affinity</dt>
                  <dd>{selectedCompound.binding_affinity} nM</dd>
                </div>
              </dl>
            </section>
          )}

          <section className={styles.tablePanel}>
            <div className={styles.panelHeader}>
              <div>
                <span>Compound library</span>
                <h2>Top {Math.min(visibleRows, compounds.length)} displayed records</h2>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>MW (g/mol)</th>
                    <th>Toxicity</th>
                    <th>Binding Affinity (nM)</th>
                  </tr>
                </thead>
                <tbody>
                  {compounds.slice(0, visibleRows).map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={c.id === selectedId ? styles.activeRow : undefined}
                    >
                      <td>{c.name}</td>
                      <td>
                        <span className={styles.categoryPill}>{c.category}</span>
                      </td>
                      <td>{c.molecular_weight}</td>
                      <td>{c.toxicity_score}</td>
                      <td>{c.binding_affinity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
