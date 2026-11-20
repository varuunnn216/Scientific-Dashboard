import { useEffect, useState, useCallback, useMemo } from 'react';
import { getCompounds, getStats, getCategories } from '../api/compounds';
import type {
  Compound,
  StatsResponse,
  CompoundFilters,
  CategoryStat,
  MolecularWeightBucket,
} from '../types';
import ScatterPlot from './ScatterPlot';
import BarChart from './BarChart';
import Histogram from './Histogram';
import CountUp from './CountUp';
import SpotlightCard from './reactbits/SpotlightCard';
import BlurText from './reactbits/BlurText';
import AnimatedContent from './reactbits/AnimatedContent';
import ShinyText from './reactbits/ShinyText';
import ParticlesBg from './reactbits/ParticlesBg';
import Magnet from './reactbits/Magnet';
import askStyles from './AskPanel.module.css';
import styles from './Dashboard.module.css';

const PAGE_SIZE = 25;

type SortField = 'name' | 'category' | 'molecular_weight' | 'toxicity_score' | 'binding_affinity';
type SortOrder = 'asc' | 'desc';

function computeCategoryStats(items: Compound[]): CategoryStat[] {
  const map = new Map<
    string,
    { count: number; sumMw: number; sumTox: number; sumBa: number }
  >();
  for (const item of items) {
    const entry = map.get(item.category) ?? { count: 0, sumMw: 0, sumTox: 0, sumBa: 0 };
    entry.count += 1;
    entry.sumMw += item.molecular_weight;
    entry.sumTox += item.toxicity_score;
    entry.sumBa += item.binding_affinity;
    map.set(item.category, entry);
  }
  return Array.from(map.entries()).map(([category, agg]) => ({
    category,
    avg_molecular_weight: Number((agg.sumMw / agg.count).toFixed(2)),
    avg_toxicity_score: Number((agg.sumTox / agg.count).toFixed(2)),
    avg_binding_affinity: Number((agg.sumBa / agg.count).toFixed(2)),
    count: agg.count,
  }));
}

function computeWeightBuckets(items: Compound[]): MolecularWeightBucket[] {
  const buckets: MolecularWeightBucket[] = [];
  for (let lo = 0; lo < 800; lo += 100) {
    const hi = lo + 100;
    const count = items.filter(
      (c) => c.molecular_weight >= lo && c.molecular_weight < hi
    ).length;
    buckets.push({ bucket: `${lo}-${hi}`, count });
  }
  return buckets;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function Dashboard() {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [apiTotal, setApiTotal] = useState<number>(0);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [minWeightInput, setMinWeightInput] = useState<string>('');
  const [maxWeightInput, setMaxWeightInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [filters, setFilters] = useState<CompoundFilters>({ page: 1, page_size: 100 });
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [tablePage, setTablePage] = useState<number>(1);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightValidationError = useMemo(() => {
    if (minWeightInput.trim() === '' || maxWeightInput.trim() === '') return null;
    const min = Number(minWeightInput);
    const max = Number(maxWeightInput);
    if (Number.isNaN(min) || Number.isNaN(max)) return 'Enter valid numeric weights.';
    if (min > max) return 'Min weight cannot exceed max weight.';
    return null;
  }, [minWeightInput, maxWeightInput]);

  // Debounce category and weight filter updates before querying API
  useEffect(() => {
    if (weightValidationError) return;

    const timer = setTimeout(() => {
      const nextMin = minWeightInput.trim() !== '' ? Number(minWeightInput) : undefined;
      const nextMax = maxWeightInput.trim() !== '' ? Number(maxWeightInput) : undefined;
      const nextCategory = categoryFilter || undefined;

      setFilters((prev) => {
        if (
          prev.category === nextCategory &&
          prev.min_weight === nextMin &&
          prev.max_weight === nextMax
        ) {
          return prev;
        }
        return {
          ...prev,
          category: nextCategory,
          min_weight: nextMin,
          max_weight: nextMax,
          page: 1,
        };
      });
      setTablePage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [categoryFilter, minWeightInput, maxWeightInput, weightValidationError]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSlowLoading(false);

    const slowTimer = setTimeout(() => {
      setSlowLoading(true);
    }, 3000);

    try {
      const [compoundsRes, statsRes] = await Promise.all([
        getCompounds(filters),
        getStats(),
      ]);
      setCompounds(compoundsRes.results);
      setApiTotal(compoundsRes.total);
      setStats(statsRes);
    } catch (err) {
      setError(
        'Unable to reach the compound data service. Please check your connection or try again.'
      );
      console.error(err);
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlowLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const hasApiFilters = Boolean(
    filters.category || filters.min_weight !== undefined || filters.max_weight !== undefined
  );
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const hasAnyFilter = hasApiFilters || trimmedSearch.length > 0;

  const filteredCompounds = useMemo(() => {
    if (!trimmedSearch) return compounds;
    return compounds.filter(
      (c) =>
        c.name.toLowerCase().includes(trimmedSearch) ||
        String(c.id).includes(trimmedSearch)
    );
  }, [compounds, trimmedSearch]);

  const sortedCompounds = useMemo(() => {
    const copy = [...filteredCompounds];
    copy.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredCompounds, sortBy, sortOrder]);

  const totalTableRows = sortedCompounds.length;
  const totalPages = Math.max(1, Math.ceil(totalTableRows / PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, totalPages);
  const startIndex = (safeTablePage - 1) * PAGE_SIZE;
  const paginatedRows = sortedCompounds.slice(startIndex, startIndex + PAGE_SIZE);
  const showingFrom = totalTableRows === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + PAGE_SIZE, totalTableRows);

  const selectedCompound = compounds.find((c) => c.id === selectedId) ?? null;

  const kpiTotalCompounds = trimmedSearch
    ? filteredCompounds.length
    : hasApiFilters
      ? apiTotal
      : stats?.total_compounds ?? apiTotal;

  const kpiCategoriesCount = hasAnyFilter
    ? new Set(filteredCompounds.map((c) => c.category)).size
    : stats?.categories.length ?? categories.length;

  const avgToxicity = filteredCompounds.length
    ? filteredCompounds.reduce((sum, c) => sum + c.toxicity_score, 0) / filteredCompounds.length
    : 0;

  const bestAffinity = filteredCompounds.length
    ? Math.min(...filteredCompounds.map((c) => c.binding_affinity))
    : 0;

  const barChartData = useMemo(() => {
    if (hasAnyFilter) {
      return computeCategoryStats(filteredCompounds);
    }
    return stats?.categories ?? [];
  }, [hasAnyFilter, filteredCompounds, stats]);

  const histogramData = useMemo(() => {
    if (hasAnyFilter) {
      return computeWeightBuckets(filteredCompounds);
    }
    return stats?.molecular_weight_distribution ?? [];
  }, [hasAnyFilter, filteredCompounds, stats]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setTablePage(1);
  };

  const handleClearFilters = () => {
    setCategoryFilter('');
    setMinWeightInput('');
    setMaxWeightInput('');
    setSearchQuery('');
    setTablePage(1);
  };

  const handleExportCsv = () => {
    if (sortedCompounds.length === 0) return;
    const headers = [
      'id',
      'name',
      'molecular_formula',
      'molecular_weight',
      'solubility',
      'toxicity_score',
      'binding_affinity',
      'category',
    ];
    const rows = sortedCompounds.map((c) =>
      [
        c.id,
        c.name,
        c.molecular_formula,
        c.molecular_weight,
        c.solubility,
        c.toxicity_score,
        c.binding_affinity,
        c.category,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'compounds-filtered.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortBy !== field) return <span className={styles.sortHint} aria-hidden="true">⇅</span>;
    return (
      <span className={styles.sortActive} aria-hidden="true">
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const getAriaSort = (field: SortField): 'ascending' | 'descending' | 'none' => {
    if (sortBy !== field) return 'none';
    return sortOrder === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <main className={styles.shell}>
      <ParticlesBg />
      <AnimatedContent delayMs={0}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroMeta}>
              <span className={styles.eyebrow}>Compound intelligence dashboard</span>
              <span className={styles.demoBadge}>
                <ShinyText text="Synthetic demo data" />
              </span>
            </div>
            <h1>
              <BlurText text="Scientific Compound Data Explorer" delayMs={45} />
            </h1>
            <p>
              Explore molecular properties, toxicity bands, and binding affinity patterns across
              the compound library.
            </p>
            <a className={askStyles.entry} href="#ask">Ask the Data →</a>
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
      </AnimatedContent>

      {error && (
        <div className={styles.error} role="alert">
          <div>
            <strong>Unable to load compound data</strong>
            <p>{error}</p>
          </div>
          <Magnet>
            <button type="button" className={styles.retryButton} onClick={fetchData}>
              Retry
            </button>
          </Magnet>
        </div>
      )}

      {loading ? (
        <section className={styles.statsGrid} aria-label="Loading summary metrics" aria-busy="true">
          {Array.from({ length: 4 }).map((_, idx) => (
            <article key={idx} className={`${styles.metric} ${styles.skeletonCard}`}>
              <div className={styles.skeletonLineShort} />
              <div className={styles.skeletonLineTall} />
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.statsGrid} aria-label="Dashboard summary">
          <AnimatedContent delayMs={40}>
            <SpotlightCard as="article" className={styles.metric}>
              <span>Total compounds</span>
              <strong>
                <CountUp value={kpiTotalCompounds} />
              </strong>
            </SpotlightCard>
          </AnimatedContent>
          <AnimatedContent delayMs={90}>
            <SpotlightCard as="article" className={styles.metric}>
              <span>Categories</span>
              <strong>
                <CountUp value={kpiCategoriesCount} />
              </strong>
            </SpotlightCard>
          </AnimatedContent>
          <AnimatedContent delayMs={140}>
            <SpotlightCard as="article" className={styles.metric}>
              <span>Avg toxicity</span>
              <strong>
                {filteredCompounds.length ? <CountUp value={avgToxicity} decimals={2} /> : '--'}
              </strong>
            </SpotlightCard>
          </AnimatedContent>
          <AnimatedContent delayMs={190}>
            <SpotlightCard as="article" className={styles.metric}>
              <span>Best affinity</span>
              <strong>
                {filteredCompounds.length ? (
                  <CountUp value={bestAffinity} decimals={2} suffix=" nM" />
                ) : (
                  '--'
                )}
              </strong>
            </SpotlightCard>
          </AnimatedContent>
        </section>
      )}

      <section className={styles.toolbar} aria-label="Compound filters">
        <label htmlFor="category-filter">
          Category
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setTablePage(1);
            }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="min-weight-filter">
          Min weight
          <input
            id="min-weight-filter"
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={minWeightInput}
            aria-invalid={Boolean(weightValidationError)}
            onChange={(e) => setMinWeightInput(e.target.value)}
          />
        </label>

        <label htmlFor="max-weight-filter">
          Max weight
          <input
            id="max-weight-filter"
            type="number"
            min="0"
            step="any"
            placeholder="800"
            value={maxWeightInput}
            aria-invalid={Boolean(weightValidationError)}
            onChange={(e) => setMaxWeightInput(e.target.value)}
          />
        </label>

        <label htmlFor="search-id-filter" className={styles.searchLabel}>
          Search by ID
          <input
            id="search-id-filter"
            type="search"
            placeholder="e.g. CMP-0413"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setTablePage(1);
            }}
          />
        </label>

        {hasAnyFilter && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClearFilters}
          >
            Clear filters
          </button>
        )}

        {weightValidationError && (
          <p className={styles.validationError} role="alert">
            {weightValidationError}
          </p>
        )}
      </section>

      {loading ? (
        <div className={styles.loadingState} aria-live="polite" aria-busy="true">
          <div className={styles.loadingBanner}>
            <span className={styles.spinner} aria-hidden="true" />
            <div>
              <strong>Loading compound library...</strong>
              {slowLoading && (
                <p className={styles.coldStartNotice}>
                  Waking up the server, this can take up to 30 seconds
                </p>
              )}
            </div>
          </div>

          <section className={styles.chartGrid}>
            <div className={`${styles.panel} ${styles.skeletonChart}`} />
            <div className={`${styles.panel} ${styles.skeletonChart}`} />
          </section>

          <section className={`${styles.tablePanel} ${styles.skeletonTable}`}>
            <div className={styles.skeletonLineShort} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </section>
        </div>
      ) : (
        <>
          <section className={styles.chartGrid}>
            <AnimatedContent delayMs={120}>
              <SpotlightCard as="article" className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span>Relationship map</span>
                    <h2>Molecular Weight vs Toxicity</h2>
                  </div>
                </div>
                <ScatterPlot
                  data={filteredCompounds}
                  totalCount={trimmedSearch ? filteredCompounds.length : apiTotal}
                  onPointClick={(c) => setSelectedId(c.id)}
                  selectedId={selectedId}
                />
              </SpotlightCard>
            </AnimatedContent>

            <AnimatedContent delayMs={180}>
              <SpotlightCard as="article" className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span>Category signal</span>
                    <h2>Avg Binding Affinity by Category</h2>
                  </div>
                </div>
                <BarChart data={barChartData} />
              </SpotlightCard>
            </AnimatedContent>
          </section>

          <AnimatedContent delayMs={220}>
            <SpotlightCard as="section" className={`${styles.panel} ${styles.widePanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <span>Distribution</span>
                  <h2>Molecular Weight Distribution</h2>
                </div>
              </div>
              <Histogram data={histogramData} />
            </SpotlightCard>
          </AnimatedContent>

          {selectedCompound && (
            <section className={styles.selectedPanel} aria-label="Selected compound details">
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

          <section className={styles.tablePanel} aria-label="Compound library table">
            <div className={styles.tableHeaderRow}>
              <div>
                <span className={styles.tableEyebrow}>Compound library</span>
                <h2>
                  {totalTableRows === 0
                    ? 'Showing 0 of 0'
                    : `Showing ${showingFrom}-${showingTo} of ${totalTableRows}`}
                </h2>
              </div>

              <button
                type="button"
                className={styles.exportButton}
                onClick={handleExportCsv}
                disabled={sortedCompounds.length === 0}
              >
                Export CSV
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th aria-sort={getAriaSort('name')}>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleSort('name')}
                      >
                        Name {renderSortIndicator('name')}
                      </button>
                    </th>
                    <th aria-sort={getAriaSort('category')}>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleSort('category')}
                      >
                        Category {renderSortIndicator('category')}
                      </button>
                    </th>
                    <th aria-sort={getAriaSort('molecular_weight')}>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleSort('molecular_weight')}
                      >
                        MW (g/mol) {renderSortIndicator('molecular_weight')}
                      </button>
                    </th>
                    <th aria-sort={getAriaSort('toxicity_score')}>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleSort('toxicity_score')}
                      >
                        Toxicity {renderSortIndicator('toxicity_score')}
                      </button>
                    </th>
                    <th aria-sort={getAriaSort('binding_affinity')}>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleSort('binding_affinity')}
                      >
                        Binding Affinity (nM) {renderSortIndicator('binding_affinity')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyTableCell}>
                        No compounds match your current filters. Try adjusting the category,
                        molecular weight range, or search query.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((c) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className={styles.pagination} aria-label="Table pagination">
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={safeTablePage <= 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {safeTablePage} of {totalPages}
                </span>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={safeTablePage >= totalPages}
                  onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        </>
      )}
    </main>
  );
}
