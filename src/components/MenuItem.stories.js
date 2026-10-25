import { expect, fn, userEvent, within } from 'storybook/test';
import MenuItem from './MenuItem.vue';

export default {
  title: 'BARS/Menu Item',
  component: MenuItem,
  args: {
    label: 'Menu item', subtitle: '', variant: 'neutral', href: '/saved-ideas', buttons: [],
    symbolType: 'none', emoji: '', icon: '', onButtonClick: fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Sets optional trailing button colors; the link row always uses Text Button Tight neutral styling.' },
    label: { control: 'text', description: 'Always-visible, left-aligned row text and accessible link name.' },
    subtitle: { control: 'text', description: 'Optional secondary line below the label.' },
    href: { control: 'text', description: 'Destination URL for the entire row link.' },
    buttons: { control: 'object', description: 'Independent Square Icon Buttons rendered at the right. Each accepts icon, label, optional variant and disabled.' },
    symbolType: { control: 'inline-radio', options: ['none', 'emoji', 'icon', 'checkbox'] },
    emoji: { control: 'text', description: 'Required when symbolType is emoji.' },
    icon: { control: 'text', description: 'Font Awesome solid icon name; required when symbolType is icon.' },
    onButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['variant', 'label', 'subtitle', 'href', 'buttons', 'symbolType', 'emoji', 'icon'] },
    docs: { description: { component: 'Draft. A semantic link row with the content controls and stories of Row Item. Its full-row link uses the Text Button Tight neutral treatment. Optional trailing Square Icon Buttons are separate actions; even a single button does not become a full-row link target.' } },
  },
  render: (args, { globals }) => ({
    components: { MenuItem },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<MenuItem v-bind="args" :theme="globalTheme" @button-click="args.onButtonClick" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: args.label });
    const row = link.closest('.menu-item');
    await expect(link).toHaveAttribute('href', args.href);
    await expect(row).toHaveTextContent(args.label);
    const subtitle = row.querySelector('.menu-item__subtitle');
    if (args.subtitle) await expect(subtitle).toHaveTextContent(args.subtitle);
    else await expect(subtitle).toBeNull();
    const symbol = row.querySelector('.menu-item__symbol');
    if (args.symbolType === 'none') await expect(symbol).toBeNull();
    if (args.symbolType === 'emoji') { await expect(symbol).toHaveTextContent(args.emoji); await expect(args.emoji).toBeTruthy(); }
    if (args.symbolType === 'icon') { await expect(symbol).toHaveClass(`fa-${args.icon}`); await expect(args.icon).toBeTruthy(); }
    if (args.symbolType === 'checkbox') {
      const checkbox = canvas.getByRole('checkbox', { name: args.label });
      await userEvent.click(checkbox);
      await expect(checkbox).toBeChecked();
      await userEvent.click(checkbox);
      await expect(checkbox).not.toBeChecked();
    }
    const buttons = Array.from(row.querySelectorAll('.menu-item__action'));
    await expect(buttons).toHaveLength(args.buttons.length);
    for (const [index, item] of args.buttons.entries()) {
      const button = buttons[index];
      await expect(button).toHaveAccessibleName(item.label);
      await expect(button.querySelector('i')).toHaveClass(`fa-${item.icon}`);
      await expect(button.closest('a')).toBeNull();
      if (item.disabled) await expect(button).toBeDisabled();
      else await userEvent.click(button);
    }
    await expect(args.onButtonClick).toHaveBeenCalledTimes(args.buttons.filter(item => !item.disabled).length);
    if (!args.buttons.length) await expect(canvas.queryByRole('button')).toBeNull();
  },
};

const buttons = [{ icon: 'bookmark', label: 'Save' }, { icon: 'bars', label: 'Menu' }];
const singleButton = [{ icon: 'bookmark', label: 'Save' }];
export const Plain = { args: { label: 'Plain menu item', href: '/plain', variant: 'neutral' } };
export const With1Button = { name: 'With 1 Button', args: { label: 'Menu item with one button', href: '/one-action', buttons: singleButton } };
export const With2Buttons = { name: 'With 2 Buttons', args: { label: 'Menu item with two buttons', href: '/two-actions', buttons } };
export const WithSubtitle = { name: 'With Subtitle', args: { label: 'Menu item', subtitle: 'A short supporting description', href: '/subtitle' } };
export const ButtonsAndSubtitles = { name: 'Buttons + Subtitles', args: { label: 'Menu item', subtitle: 'A short supporting description', href: '/buttons-subtitles', buttons } };
export const IconWithButtons = { name: 'Icon w/ Buttons', args: { label: 'Location', symbolType: 'icon', icon: 'location-dot', href: '/icon-buttons', buttons } };
export const IconWithSubtitle = { name: 'Icon w/ Subtitle', args: { label: 'Location', subtitle: 'A short supporting description', symbolType: 'icon', icon: 'location-dot', href: '/icon-subtitle' } };
export const IconWithButtonsAndSubtitle = { name: 'Icon w/ Buttons & Subtitle', args: { label: 'Location', subtitle: 'A short supporting description', symbolType: 'icon', icon: 'location-dot', href: '/icon-all', buttons } };
export const EmojiWithButtons = { name: 'Emoji w/ Buttons', args: { label: 'New idea', symbolType: 'emoji', emoji: '💡', href: '/emoji-buttons', buttons } };
export const EmojiWithSubtitle = { name: 'Emoji w/ Subtitle', args: { label: 'New idea', subtitle: 'A short supporting description', symbolType: 'emoji', emoji: '💡', href: '/emoji-subtitle' } };
export const EmojiWithButtonsAndSubtitle = { name: 'Emoji w/ Buttons & Subtitle', args: { label: 'New idea', subtitle: 'A short supporting description', symbolType: 'emoji', emoji: '💡', href: '/emoji-all', buttons } };
export const CheckboxWithButtons = { name: 'Checkbox w/ Buttons', args: { label: 'Select menu item', symbolType: 'checkbox', href: '/checkbox-buttons', buttons } };
export const CheckboxWithSubtitle = { name: 'Checkbox w/ Subtitle', args: { label: 'Select menu item', subtitle: 'A short supporting description', symbolType: 'checkbox', href: '/checkbox-subtitle' } };
export const CheckboxWithButtonsAndSubtitle = { name: 'Checkbox w/ Buttons & Subtitle', args: { label: 'Select menu item', subtitle: 'A short supporting description', symbolType: 'checkbox', href: '/checkbox-all', buttons } };
