import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref, watch } from 'vue';
import AddressBar from './AddressBar.vue';

const results = [
  { id: 'pegasus-city-brewery', label: 'Pegasus City Brewery', subtitle: '1508 Commerce St, Dallas, TX 75201' },
  { id: 'commerce-street', label: '1508 Commerce St', subtitle: 'Dallas, TX 75201' },
];

export default {
  title: 'FORM/Address Bar',
  component: AddressBar,
  args: {
    theme: undefined,
    mode: 'browsing',
    modelValue: '1508 Commerce St, Dallas, TX 75201',
    placeholder: 'Search address or place',
    results,
    onUpdateMode: fn(),
    onModeChange: fn(),
    onUpdateAddress: fn(),
    onMenuClick: fn(),
    onSelectResult: fn(),
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    mode: { control: 'inline-radio', options: ['browsing', 'searching', 'viewing'], description: 'Browsing becomes searching when the address field receives focus.' },
    modelValue: { control: false, table: { disable: true } },
    placeholder: { control: false, table: { disable: true } },
    results: { control: false, table: { disable: true } },
    onUpdateMode: { table: { disable: true } },
    onModeChange: { table: { disable: true } },
    onUpdateAddress: { table: { disable: true } },
    onMenuClick: { table: { disable: true } },
    onSelectResult: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'mode'] },
    docs: { description: { component: 'Draft. Floating address bar composed from Square Icon Button, Text With Inline Button, and Row Item. Browsing shows the current address; focusing its field switches to Searching. Searching shows a shadowed, rounded list of place/address results. Viewing locks the address field and changes the trailing action to a location pin.' } },
  },
  render: (args, { globals }) => ({
    components: { AddressBar },
    setup() {
      const mode = ref(args.mode);
      watch(() => args.mode, value => { mode.value = value; });
      const updateMode = value => {
        mode.value = value;
        args.onUpdateMode(value);
      };
      return { args, globalTheme: globals.theme, mode, updateMode };
    },
    template: '<AddressBar v-bind="args" :mode="mode" :theme="args.theme || globalTheme" @update:mode="updateMode" @mode-change="args.onModeChange" @update:model-value="args.onUpdateAddress" @menu-click="args.onMenuClick" @select-result="args.onSelectResult" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const bar = canvasElement.querySelector('.address-bar');
    const input = canvas.getByRole('textbox');
    const menuButton = canvas.getByRole('button', { name: 'Menu' });
    await expect(canvasElement.querySelectorAll('.address-bar')).toHaveLength(1);
    await expect(bar).toHaveAttribute('data-mode', args.mode);
    await expect(input).toHaveValue(args.modelValue);
    await userEvent.click(menuButton);
    await expect(args.onMenuClick).toHaveBeenCalledTimes(1);

    if (args.mode === 'browsing') {
      await userEvent.click(input);
      await expect(input).toHaveFocus();
      await waitFor(() => expect(canvasElement.querySelector('.address-bar')).toHaveAttribute('data-mode', 'searching'));
      await expect(args.onUpdateMode).toHaveBeenCalledWith('searching');
      await expect(canvas.getByRole('list', { name: 'Address search results' })).toBeVisible();
      await userEvent.type(canvas.getByRole('textbox'), 'x');
      await expect(args.onUpdateAddress).toHaveBeenCalled();
    } else if (args.mode === 'searching') {
      await expect(canvas.getByRole('list', { name: 'Address search results' })).toBeVisible();
      await expect(canvas.getAllByRole('listitem')).toHaveLength(results.length);
      await expect(canvas.getByText('Pegasus City Brewery')).toBeVisible();
      await expect(canvas.getByText('1508 Commerce St, Dallas, TX 75201')).toBeVisible();
      await userEvent.click(canvas.getByRole('button', { name: 'Go to Pegasus City Brewery' }));
      await expect(args.onSelectResult).toHaveBeenCalledWith(results[0]);
    } else {
      await expect(input).toHaveAttribute('readonly');
      await expect(canvas.queryByRole('list', { name: 'Address search results' })).toBeNull();
      await expect(canvas.getByRole('button', { name: 'Current location' }).querySelector('i')).toHaveClass('fa-location-dot');
      await userEvent.type(input, 'x');
      await expect(input).toHaveValue(args.modelValue);
      await expect(bar).toHaveAttribute('data-mode', 'viewing');
    }
  },
};

export const Browsing = { args: { mode: 'browsing' } };
export const Searching = { args: { mode: 'searching', modelValue: 'Pegasus' } };
export const Viewing = { args: { mode: 'viewing' } };
