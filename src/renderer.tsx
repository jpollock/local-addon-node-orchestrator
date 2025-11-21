export default function (context: any): void {
  console.log('[Node Orchestrator] Renderer loading...');
  const { React, hooks } = context;
  console.log('[Node Orchestrator] React:', !!React, 'Hooks:', !!hooks);

  const NodeAppsInfo = (props: any) => {
    // The site data is passed directly as props, not as props.site
    const site = props;

    // Check if we have valid site data
    if (!site || !site.id) {
      return null; // Don't show anything if no site data
    }

    class NodeAppsManager extends React.Component<any, any> {
      state = { testResult: '' };

      testIPC = async () => {
        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:get-apps', {
            siteId: site.id
          });

          if (response.success) {
            const appCount = response.apps?.length || 0;
            this.setState({
              testResult: `✅ Connection successful! ${appCount} Node.js app(s) configured for this site.`
            });
          } else {
            this.setState({ testResult: `⚠️ ${response.error}` });
          }
        } catch (error: any) {
          this.setState({ testResult: `❌ Error: ${error.message}` });
        }
      };

      render() {
        const { name, domain } = this.props.site;
        return React.createElement(
          'div',
          { style: { padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', marginTop: '20px' } },
          React.createElement('h3', null, '🚀 Node.js Orchestrator'),
          React.createElement('p', null, `Site: ${name} (${domain})`),
          React.createElement(
            'button',
            {
              onClick: this.testIPC,
              style: {
                padding: '8px 16px',
                backgroundColor: '#007cba',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }
            },
            'Test IPC'
          ),
          this.state.testResult && React.createElement(
            'div',
            { style: { marginTop: '10px' } },
            React.createElement('small', null, this.state.testResult)
          )
        );
      }
    }

    return React.createElement(NodeAppsManager, { site });
  };

  // Log what hooks are available
  console.log('[Node Orchestrator] Available hooks object:', hooks);
  if (hooks) {
    console.log('[Node Orchestrator] Hook methods:', Object.keys(hooks));

    // Try to find what content areas exist
    if (hooks.getContentAreas) {
      console.log('[Node Orchestrator] Content areas:', hooks.getContentAreas());
    }
  }

  // Try ALL possible hook locations
  const possibleHooks = [
    'SiteInfoOverview',
    'SiteInfoOverview_Top',
    'SiteInfoOverview_Bottom',
    'SiteInfo',
    'SiteInfoSidebar',
    'SiteDetails',
    'SiteOverview',
    'sitesListItem',
    'belowSitesList',
    'aboveSitesList',
    'main',
    'content'
  ];

  possibleHooks.forEach(hookName => {
    try {
      hooks.addContent(hookName, NodeAppsInfo);
      console.log(`[Node Orchestrator] ✅ Registered with: ${hookName}`);
    } catch (e) {
      // Silent fail for non-existent hooks
    }
  });

  // Also try addFilter if it exists
  if (hooks.addFilter) {
    console.log('[Node Orchestrator] addFilter exists, trying to use it...');
    try {
      hooks.addFilter('siteInfoTabs', (tabs: any) => {
        console.log('[Node Orchestrator] Current tabs:', tabs);
        return tabs;
      });
    } catch (e) {
      console.error('[Node Orchestrator] addFilter failed:', e);
    }
  }

  console.log('[Node Orchestrator] Renderer setup complete');
}