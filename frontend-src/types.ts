export interface Compound {
  id: number;
  name: string;
  molecular_formula: string;
  molecular_weight: number;
  solubility: number;
  toxicity_score: number;
  binding_affinity: number;
  category: string;
  created_at: string;
}

export interface PaginatedCompounds {
  total: number;
  page: number;
  page_size: number;
  results: Compound[];
}

export interface CategoryStat {
  category: string;
  avg_molecular_weight: number;
  avg_toxicity_score: number;
  avg_binding_affinity: number;
  count: number;
}

export interface MolecularWeightBucket {
  bucket: string;
  count: number;
}

export interface StatsResponse {
  total_compounds: number;
  categories: CategoryStat[];
  molecular_weight_distribution: MolecularWeightBucket[];
}

export interface CompoundFilters {
  page?: number;
  page_size?: number;
  category?: string;
  min_weight?: number;
  max_weight?: number;
  min_toxicity?: number;
  max_toxicity?: number;
  sort_by?: 'id' | 'name' | 'molecular_weight' | 'toxicity_score' | 'binding_affinity';
  sort_order?: 'asc' | 'desc';
}
