import { useEffect, useState, useCallback } from 'react';
import { getCompounds, getStats, getCategories } from '../api/compounds';
import type { Compound, StatsResponse, CompoundFilters } from '../types';
import ScatterPlot from './ScatterPlot';
import BarChart from './BarChart';

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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        Scientific Compound Data Explorer
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        {stats ? `${stats.total_compounds} compounds across ${stats.categories.length} categories` : 'Loading...'}
      </p>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <select
          value={filters.category ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, category: e.target.value || undefined, page: 1 }))
          }
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Min weight"
          onChange={(e) =>
            setFilters((f) => ({ ...f, min_weight: e.target.value ? Number(e.target.value) : undefined, page: 1 }))
          }
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', width: 110 }}
        />
        <input
          type="number"
          placeholder="Max weight"
          onChange={(e) =>
            setFilters((f) => ({ ...f, max_weight: e.target.value ? Number(e.target.value) : undefined, page: 1 }))
          }
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', width: 110 }}
        />
      </div>

      {loading ? (
        <p>Loading dashboard...</p>
      ) : (
        <>
          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Molecular Weight vs Toxicity
              </h3>
              <ScatterPlot data={compounds} onPointClick={(c) => setSelectedId(c.id)} selectedId={selectedId} />
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Avg Binding Affinity by Category
              </h3>
              {stats && <BarChart data={stats.categories} />}
            </div>
          </div>

          {/* Selected compound detail */}
          {selectedCompound && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <strong>{selectedCompound.name}</strong> ({selectedCompound.molecular_formula}) —{' '}
              {selectedCompound.category} | MW: {selectedCompound.molecular_weight} g/mol | Toxicity:{' '}
              {selectedCompound.toxicity_score} | Binding Affinity: {selectedCompound.binding_affinity} nM
            </div>
          )}

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Name</th>
                <th style={{ padding: 8 }}>Category</th>
                <th style={{ padding: 8 }}>MW (g/mol)</th>
                <th style={{ padding: 8 }}>Toxicity</th>
                <th style={{ padding: 8 }}>Binding Affinity (nM)</th>
              </tr>
            </thead>
            <tbody>
              {compounds.slice(0, 25).map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: c.id === selectedId ? '#eff6ff' : 'transparent',
                  }}
                >
                  <td style={{ padding: 8 }}>{c.name}</td>
                  <td style={{ padding: 8 }}>{c.category}</td>
                  <td style={{ padding: 8 }}>{c.molecular_weight}</td>
                  <td style={{ padding: 8 }}>{c.toxicity_score}</td>
                  <td style={{ padding: 8 }}>{c.binding_affinity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
