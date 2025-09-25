import React from 'react';
import NodeAppsTab from './components/NodeAppsTab';

interface AddonRendererContext {
  React: typeof React;
  hooks: any;
  electron: any;
  Router: any;
  route: any;
}

export default function (context: AddonRendererContext): void {
  const { React, hooks } = context;

  // Add Node.js Apps tab to site info
  hooks.addContent('SiteInfoTools', NodeAppsTab);

  // Add menu item to site tools
  hooks.addFilter(
    'siteInfoToolsItem',
    (items: any[], site: any) => {
      return [
        ...items,
        {
          label: 'Node.js Apps',
          icon: 'nodejs',
          onClick: () => {
            // Navigate to Node.js apps tab
            console.log('Opening Node.js Apps for', site.name);
          }
        }
      ];
    }
  );
}
