import type { Meta, StoryObj } from '@storybook/react-vite';
import ScatterPlot from '../components/ScatterPlot';
import type { Compound } from '../types';

const mockCompounds: Compound[] = [
  { id: 1, name: 'CMP-0101', molecular_formula: 'C12H8N2O3', molecular_weight: 250, solubility: 5.2, toxicity_score: 3.1, binding_affinity: 45, category: 'Antiviral', created_at: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'CMP-0202', molecular_formula: 'C18H15ClN4', molecular_weight: 420, solubility: 12.7, toxicity_score: 6.8, binding_affinity: 120, category: 'Kinase Inhibitor', created_at: '2026-01-01T00:00:00Z' },
  { id: 3, name: 'CMP-0303', molecular_formula: 'C8H10O2S', molecular_weight: 180, solubility: 0.9, toxicity_score: 1.5, binding_affinity: 30, category: 'Antiviral', created_at: '2026-01-01T00:00:00Z' },
  { id: 4, name: 'CMP-0404', molecular_formula: 'C22H20F3N5O', molecular_weight: 550, solubility: 45.3, toxicity_score: 8.2, binding_affinity: 200, category: 'Anticancer', created_at: '2026-01-01T00:00:00Z' },
  { id: 5, name: 'CMP-0505', molecular_formula: 'C14H12N4O2', molecular_weight: 310, solubility: 22.1, toxicity_score: 4.0, binding_affinity: 75, category: 'Anti-inflammatory', created_at: '2026-01-01T00:00:00Z' },
  { id: 6, name: 'CMP-0606', molecular_formula: 'C20H18Cl2N2O', molecular_weight: 480, solubility: 8.5, toxicity_score: 7.3, binding_affinity: 150, category: 'Kinase Inhibitor', created_at: '2026-01-01T00:00:00Z' },
  { id: 7, name: 'CMP-0707', molecular_formula: 'C10H9N3S', molecular_weight: 200, solubility: 3.4, toxicity_score: 2.2, binding_affinity: 55, category: 'Antibiotic', created_at: '2026-01-01T00:00:00Z' },
  { id: 8, name: 'CMP-0808', molecular_formula: 'C25H22N6O4', molecular_weight: 620, solubility: 60.0, toxicity_score: 9.1, binding_affinity: 350, category: 'Anticancer', created_at: '2026-01-01T00:00:00Z' },
  { id: 9, name: 'CMP-0909', molecular_formula: 'C16H14O3', molecular_weight: 350, solubility: 15.8, toxicity_score: 5.5, binding_affinity: 90, category: 'CNS Agent', created_at: '2026-01-01T00:00:00Z' },
  { id: 10, name: 'CMP-0110', molecular_formula: 'C11H10F2N2O2', molecular_weight: 280, solubility: 7.2, toxicity_score: 3.9, binding_affinity: 65, category: 'Antifungal', created_at: '2026-01-01T00:00:00Z' },
];

const meta = {
  title: 'Components/ScatterPlot',
  component: ScatterPlot,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ScatterPlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data: mockCompounds, totalCount: 250 },
};

export const WithSelection: Story = {
  args: { data: mockCompounds, totalCount: 10, selectedId: 4 },
};

export const Empty: Story = {
  args: { data: [], totalCount: 0 },
};