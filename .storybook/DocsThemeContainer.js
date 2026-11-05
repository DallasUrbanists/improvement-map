import { createElement, useEffect, useState } from 'react';
import { DocsContainer as StorybookDocsContainer } from '@storybook/addon-docs/blocks';
import { themes } from 'storybook/theming';

function themeFor(value) {
  return value === 'dark' ? themes.dark : themes.light;
}

function selectedTheme(context) {
  // Storybook 10's docs context exposes the current toolbar globals through its store.
  return context.store?.userGlobals?.globals?.theme;
}

export function DocsThemeContainer({ children, context, ...props }) {
  const [theme, setTheme] = useState(() => themeFor(selectedTheme(context)));

  useEffect(() => {
    const updateTheme = ({ globals, userGlobals } = {}) => {
      const currentGlobals = globals ?? userGlobals?.globals;
      setTheme(themeFor(currentGlobals?.theme ?? selectedTheme(context)));
    };

    context.channel.on('globalsUpdated', updateTheme);
    return () => context.channel.off('globalsUpdated', updateTheme);
  }, [context]);

  return createElement(StorybookDocsContainer, { ...props, context, theme }, children);
}
