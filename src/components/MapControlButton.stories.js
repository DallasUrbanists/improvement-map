import { expect, fn, userEvent, within } from 'storybook/test';
import MapControlButton from './MapControlButton.vue';
export default {
  title: 'REFERENCE/Components/Controls/Map control button', component: MapControlButton,
  args: { disabled: false, onClick: fn() },
  parameters: { docs: { description: { component: 'Draft. Use for actions on a map-ui surface. Native attributes/listeners pass through; default slot supplies text or a decorative icon. Icon-only actions require aria-label. Omit pressed for an action, set it for a toggle. Use a link for navigation. Colors inherit from the containing map-ui surface.' } } },
  render: args => ({ components: { MapControlButton }, setup: () => ({ args }), template: '<MapControlButton v-bind="args">Newest</MapControlButton>' }),
};
export const Default = { play: async ({ canvasElement, args }) => {
  const button = within(canvasElement).getByRole('button', { name: 'Newest' });
  await userEvent.click(button); await expect(args.onClick).toHaveBeenCalledOnce();
  button.focus(); await userEvent.keyboard('{Enter}'); await expect(args.onClick).toHaveBeenCalledTimes(2);
} };
export const Pressed = { args: { pressed: true } };
export const Disabled = { args: { disabled: true }, play: async ({ canvasElement, args }) => {
  const button = within(canvasElement).getByRole('button');
  await expect(button).toBeDisabled(); await userEvent.click(button); await expect(args.onClick).not.toHaveBeenCalled();
} };
export const IconOnly = { render: args => ({ components: { MapControlButton }, setup: () => ({ args }), template: '<MapControlButton v-bind="args" aria-label="Locate me"><i class="fa-solid fa-crosshairs" aria-hidden="true"></i></MapControlButton>' }) };
