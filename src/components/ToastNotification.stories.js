import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import { ref } from 'vue';
import ToastNotification from './ToastNotification.vue';

export default {
  title: 'BARS/Toast Notification',
  component: ToastNotification,
  args: { message: 'Your recommendation was hidden.', autoDismissSeconds: null, buttons: [], onDismiss: fn(), onAction: fn() },
  argTypes: {
    message: { control: 'text', description: 'Notification text.' },
    autoDismissSeconds: { control: 'number', description: 'Seconds before dismissal; null requires manual dismissal.' },
    buttons: { control: 'object', description: 'Optional links/actions displayed beside Dismiss.' },
    notifications: { control: false }, theme: { control: false },
    onDismiss: { table: { disable: true } }, onAction: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Draft. Fixed stack of level-5 neutral notifications. Each toast slides down, stays outside document flow, and can be dismissed by its Dismiss action or by swiping in any direction. Optional action links sit beside Dismiss; autoDismissSeconds defaults to null. Theme follows the global toolbar.' } },
  },
  render: (args, { globals }) => ({
    components: { ToastNotification },
    setup: () => ({ args, theme: globals.theme }),
    template: '<ToastNotification :message="args.message" :buttons="args.buttons" :auto-dismiss-seconds="args.autoDismissSeconds" :theme="theme" @dismiss="args.onDismiss" @action="args.onAction" />',
  }),
};

export const OneToast = {
  name: 'One toast',
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const toast = await page.findByRole('status');
    await expect(toast).toHaveTextContent(args.message);
    await waitFor(() => expect(page.getByRole('button', { name: `Dismiss ${args.message}` })).toBeVisible());
    await userEvent.click(page.getByRole('button', { name: `Dismiss ${args.message}` }));
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(page.queryByRole('status')).toBeNull());
  },
};

export const ThreeToasts = {
  name: 'Three toasts',
  render: (args, { globals }) => ({
    components: { ToastNotification },
    setup: () => ({ args, theme: globals.theme, notifications: [
      { id: 'first', message: 'Recommendation hidden.' },
      { id: 'second', message: 'Saved to My actions.' },
      { id: 'third', message: 'Your changes are ready.' },
    ] }),
    template: '<ToastNotification :notifications="notifications" :theme="theme" @dismiss="args.onDismiss" />',
  }),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findAllByRole('status')).toHaveLength(3);
    const toasts = page.getAllByRole('status');
    await expect(toasts[1].getBoundingClientRect().top).toBeGreaterThan(toasts[0].getBoundingClientRect().bottom);
    await expect(toasts[2].getBoundingClientRect().top).toBeGreaterThan(toasts[1].getBoundingClientRect().bottom);
  },
};

export const AutoDismiss = {
  name: 'Auto dismiss',
  render: (args, { globals }) => ({
    components: { ToastNotification },
    setup() {
      const open = ref(false);
      return { args, theme: globals.theme, open };
    },
    template: '<div><a href="#" @click.prevent="open = true">Trigger notification</a><ToastNotification v-if="open" message="This notification disappears after five seconds." :auto-dismiss-seconds="5" :theme="theme" @dismiss="open = false" /></div>',
  }),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('link', { name: 'Trigger notification' }));
    await expect(await page.findByRole('status')).toHaveTextContent('five seconds');
  },
};

export const ExtraButton = {
  name: 'Extra button',
  args: { message: 'A recommendation is ready to review.', buttons: [{ label: 'View', onClick: fn() }] },
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await page.findByRole('status');
    const view = page.getByRole('button', { name: 'View' });
    await userEvent.click(view);
    await expect(args.buttons[0].onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(page.getByRole('status')).toBeVisible());
    await userEvent.click(page.getByRole('button', { name: `Dismiss ${args.message}` }));
    await waitFor(() => expect(page.queryByRole('status')).toBeNull());
  },
};
