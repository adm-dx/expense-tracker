/**
 * @jest-environment node
 */
import { categorySchema } from '@web/features/category/upsert/model/schema';

const valid = { name: 'Pets', icon: 'paw-print' };

it('accepts a name and a known icon, trimming the name', () => {
  expect(categorySchema.parse({ ...valid, name: '  Pets ' })).toEqual(valid);
});

it.each([
  ['an empty name', { name: '   ' }, 'Enter a name'],
  [
    'a name over 50 characters',
    { name: 'a'.repeat(51) },
    'At most 50 characters',
  ],
  ['an unknown icon', { icon: 'rocket' }, 'Choose an icon'],
])('rejects %s', (_label, override, message) => {
  const result = categorySchema.safeParse({ ...valid, ...override });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(message);
});
