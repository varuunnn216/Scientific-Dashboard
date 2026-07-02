import type { Meta, StoryObj } from '@storybook/react-vite';
import Histogram from '../components/Histogram';
import type { MolecularWeightBucket } from '../types';

const mockBuckets: MolecularWeightBucket[] = [
  { bucket: '0-100', count: 5 },
  { bucket: '100-200', count: 18 },
  { bucket: '200-300', count: 32 },
  { bucket: '300-400', count: 45 },
  { bucket: '400-500', count: 28 },
  { bucket: '500-600', count: 15 },
  { bucket: '600-700', count: 7 },
  { bucket: '700-800', count: 2 },
];

const meta = {
  title: 'Components/Histogram',
  component: Histogram,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data: mockBuckets },
};

export const SingleBucket: Story = {
  args: { data: [{ bucket: '300-400', count: 45 }] },
};

export const Empty: Story = {
  args: { data: [] },
};