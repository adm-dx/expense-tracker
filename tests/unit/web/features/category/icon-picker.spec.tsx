import { CATEGORY_ICONS } from '@expense-tracker/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconPicker } from '@web/features/category/upsert/ui/icon-picker';

it('shows the current icon on the trigger', () => {
  render(<IconPicker value="shopping-cart" onChange={jest.fn()} />);

  expect(
    screen.getByRole('button', { name: 'Icon: Shopping cart. Change icon' })
  ).toBeInTheDocument();
});

it('offers every category icon and marks the current one', async () => {
  const user = userEvent.setup();
  render(<IconPicker value="banknote" onChange={jest.fn()} />);

  await user.click(screen.getByRole('button', { name: /Change icon/ }));

  const group = await screen.findByRole('group', { name: 'Category icons' });
  const options = group.querySelectorAll('button');
  expect(options).toHaveLength(CATEGORY_ICONS.length);
  expect(screen.getByRole('button', { name: 'Banknote' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByRole('button', { name: 'Pizza' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

it('reports the picked icon and closes', async () => {
  const user = userEvent.setup();
  const onChange = jest.fn();
  render(<IconPicker value="banknote" onChange={onChange} />);

  await user.click(screen.getByRole('button', { name: /Change icon/ }));
  await user.click(await screen.findByRole('button', { name: 'Pizza' }));

  expect(onChange).toHaveBeenCalledWith('pizza');
  expect(
    screen.queryByRole('group', { name: 'Category icons' })
  ).not.toBeInTheDocument();
});
