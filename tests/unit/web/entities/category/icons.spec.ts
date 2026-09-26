/**
 * @jest-environment node
 */
import { CATEGORY_ICONS } from '@expense-tracker/types';
import {
  CATEGORY_ICON_COMPONENTS,
  FALLBACK_CATEGORY_ICON,
  getCategoryIconLabel,
  isCategoryIcon,
  resolveCategoryIcon,
} from '@web/entities/category/lib/icons';

it('has a lucide component for every shared icon key, and nothing else', () => {
  expect(Object.keys(CATEGORY_ICON_COMPONENTS).sort()).toEqual(
    [...CATEGORY_ICONS].sort()
  );
  for (const icon of CATEGORY_ICONS) {
    expect(CATEGORY_ICON_COMPONENTS[icon]).toBeDefined();
  }
});

it('uses distinct pictograms', () => {
  const components = new Set(Object.values(CATEGORY_ICON_COMPONENTS));

  expect(components.size).toBe(CATEGORY_ICONS.length);
});

it('recognizes only the shared keys', () => {
  expect(isCategoryIcon('banknote')).toBe(true);
  expect(isCategoryIcon('rocket')).toBe(false);
});

it('falls back to a neutral icon for an unknown key', () => {
  expect(resolveCategoryIcon('utensils')).toBe('utensils');
  expect(resolveCategoryIcon('rocket')).toBe(FALLBACK_CATEGORY_ICON);
});

it.each([
  ['shopping-cart', 'Shopping cart'],
  ['gamepad-2', 'Gamepad'],
  ['car', 'Car'],
])('labels %s as "%s"', (icon, label) => {
  expect(getCategoryIconLabel(icon)).toBe(label);
});
