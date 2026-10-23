import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';
addons.setConfig({ theme: create({ base: 'dark', brandTitle: 'Improvement Map · UI catalog', brandUrl: '../', brandTarget: '_self' }) });
