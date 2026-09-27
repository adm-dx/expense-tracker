/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { COLOR_SCHEMES } from '@expense-tracker/types';

// Every token the Tailwind config maps to a CSS variable.
const TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
];

const css = readFileSync(
  join(__dirname, '../../../../apps/web/src/app/globals.css'),
  'utf8'
);

/** The declarations of the rule with exactly this selector. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No rule for ${selector}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('globals.css color schemes', () => {
  describe.each(COLOR_SCHEMES)('%s', (scheme) => {
    it.each([
      ['light', `[data-scheme='${scheme}']`],
      ['dark', `[data-scheme='${scheme}'][data-mode='dark']`],
    ])('defines every token in %s', (_mode, selector) => {
      const rule = block(selector);
      for (const token of TOKENS) {
        expect(rule).toMatch(
          new RegExp(`--${token}: \\d+(\\.\\d+)? \\d+(\\.\\d+)?% \\d+(\\.\\d+)?%;`)
        );
      }
    });
  });

  it('keeps slate as the fallback before the theme script runs', () => {
    const root = block(':root');
    const slate = block("[data-scheme='slate']");

    for (const token of TOKENS) {
      const pattern = new RegExp(`--${token}: ([^;]+);`);
      expect(root.match(pattern)?.[1]).toBe(slate.match(pattern)?.[1]);
    }
  });
});
