import type { Meta, StoryObj } from '@storybook/react-vite';
import BarChart from '../components/BarChart';
import type { CategoryStat } from '../types';

const mockCategories: CategoryStat[] = [
  { category: 'Antiviral', avg_molecular_weight: 280.5, avg_toxicity_score: 3.2, avg_binding_affinity: 55.3, count: 35 },
  { category: 'Kinase Inhibitor', avg_molecular_weight: 450.1, avg_toxicity_score: 6.8, avg_binding_affinity: 140.7, count: 42 },
  { category: 'Antibiotic', avg_molecular_weight: 320.0, avg_toxicity_score: 4.1, avg_binding_affinity: 80.2, count: 28 },
  { category: 'Antifungal', avg_molecular_weight: 350.7, avg_toxicity_score: 5.0, avg_binding_affinity: 95.5, count: 20 },
  { category: 'Anticancer', avg_molecular_weight: 520.3, avg_toxicity_score: 7.5, avg_binding_affinity: 210.1, count: 50 },
  { category: 'Anti-inflammatory', avg_molecular_weight: 310.2, avg_toxicity_score: 3.8, avg_binding_affinity: 70.9, count: 33 },
  { category: 'CNS Agent', avg_molecular_weight: 380.4, avg_toxicity_score: 5.9, avg_binding_affinity: 110.3, count: 25 },
];

const meta = {
  title: 'Components/BarChart',
  component: BarChart,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data: mockCategories },
};

export const SingleCategory: Story = {
  args: { data: [mockCategories[0]] },
};

export const Empty: Story = {
  args: { data: [] },
};