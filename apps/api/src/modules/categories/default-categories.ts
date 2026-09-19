export interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
}

// Seeded for every newly registered user so transactions can be added right away.
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Food', color: '#F97316', icon: 'utensils' },
  { name: 'Transport', color: '#3B82F6', icon: 'car' },
  { name: 'Housing', color: '#8B5CF6', icon: 'house' },
  { name: 'Entertainment', color: '#EC4899', icon: 'clapperboard' },
  { name: 'Health', color: '#EF4444', icon: 'heart-pulse' },
  { name: 'Shopping', color: '#EAB308', icon: 'shopping-bag' },
  { name: 'Salary', color: '#22C55E', icon: 'wallet' },
  { name: 'Other', color: '#64748B', icon: 'circle-ellipsis' },
];
