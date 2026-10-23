import type { StorybookConfig } from '@storybook/react-vite';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import svgr from 'vite-plugin-svgr';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [getAbsolutePath('@storybook/addon-themes')],
  framework: getAbsolutePath('@storybook/react-vite'),
  viteFinal: async (config) => {
    if (config.resolve) {
      config.resolve.tsconfigPaths = true;
    } else {
      config.resolve = { tsconfigPaths: true };
    }
    config.plugins ??= [];
    config.plugins.push(svgr({ include: '**/*.svg' }));
    // @base-ui/react (and other RSC libs) ship 'use client'; Vite/Rolldown
    // warns that the directive may not be preserved — harmless in Storybook.
    config.build ??= {};
    config.build.rollupOptions ??= {};
    const prevOnWarn = config.build.rollupOptions.onwarn;
    config.build.rollupOptions.onwarn = (warning, defaultHandler) => {
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
      if (prevOnWarn) prevOnWarn(warning, defaultHandler);
      else defaultHandler(warning);
    };
    return config;
  },
  features: {
    sidebarOnboardingChecklist: false,
  },
};
export default config;
