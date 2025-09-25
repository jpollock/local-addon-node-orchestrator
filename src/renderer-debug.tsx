// React is provided by Local's context

/**
 * Minimal working renderer that will compile
 */
export default function (context: any): void {
  console.log('[Node Orchestrator] Renderer function called with context:', context);

  const { React, hooks } = context;

  console.log('[Node Orchestrator] React available:', !!React);
  console.log('[Node Orchestrator] Hooks available:', !!hooks);
  console.log('[Node Orchestrator] Available hooks methods:', hooks ? Object.keys(hooks) : 'none');

  // Simple component without hooks (to avoid React hooks error)
  const NodeAppsInfo = (props: any) => {
    console.log('[Node Orchestrator] NodeAppsInfo component called with props:', props);
    console.log('[Node Orchestrator] Props keys:', Object.keys(props || {}));

    // Try different ways to access site
    const site = props?.site || props?.siteData || props;

    console.log('[Node Orchestrator] Extracted site:', site);

    // Always render something to see if component is showing
    if (!site || !site.id) {
      return React.createElement(
        'div',
        { style: { padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', marginTop: '10px' } },
        React.createElement('p', { style: { color: '#856404' } }, '⚠️ Node.js Orchestrator: Waiting for site data...')
      );
    }

    // Create a class component to handle state
    class NodeAppsManager extends React.Component<any, any> {
      constructor(props: any) {
        super(props);
        this.state = {
          testResult: ''
        };
      }

      testIPC = async () => {
        try {
          console.log('[Node Orchestrator] Testing IPC...');

          // Access electron from context
          const electron = context.electron || (window as any).electron;
          if (!electron) {
            this.setState({ testResult: 'Error: Electron not available' });
            return;
          }

          console.log('[Node Orchestrator] Electron available, sending IPC message...');

          const testData = {
            siteId: this.props.site.id,
            siteName: this.props.site.name,
            message: 'Testing IPC communication',
            timestamp: new Date().toISOString()
          };

          console.log('[Node Orchestrator] Sending data:', testData);

          const response = await electron.ipcRenderer.invoke('node-orchestrator:test', testData);

          console.log('[Node Orchestrator] IPC Response received:', response);
          this.setState({ testResult: `IPC Response: ${JSON.stringify(response, null, 2)}` });
        } catch (error: any) {
          console.error('[Node Orchestrator] IPC Error:', error);
          this.setState({ testResult: `Error: ${error.message}` });
        }
      };

      render() {
        console.log('[Node Orchestrator] NodeAppsManager rendering for site:', this.props.site.name);
        const { site } = this.props;
        const { testResult } = this.state;

        return React.createElement(
          'div',
          { style: { padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', marginTop: '20px' } },
          React.createElement('h3', { style: { color: '#333' } }, '🚀 Node.js Orchestrator'),
          React.createElement('p', null, `Manage Node.js apps for ${site.name}`),
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
                cursor: 'pointer',
                marginTop: '10px'
              }
            },
            'Test IPC Connection'
          ),
          testResult && React.createElement(
            'div',
            { style: { marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' } },
            React.createElement('small', null, testResult)
          ),
          React.createElement('p', { style: { marginTop: '10px', fontSize: '12px', color: '#666' } }, 'Status: Addon loaded successfully!')
        );
      }
    }

    // Return the class component
    return React.createElement(NodeAppsManager, { site });
  };

  // Create a simple test component that always renders
  const SimpleTestComponent = () => {
    return React.createElement(
      'div',
      { style: { padding: '15px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px', margin: '10px 0' } },
      React.createElement('h4', { style: { color: '#155724', margin: '0 0 10px 0' } }, '✅ Node.js Orchestrator Test Component'),
      React.createElement('p', { style: { color: '#155724', margin: '0' } }, 'This component is rendering! If you see this, the addon is working.')
    );
  };

  // Add to site info - try both locations for visibility
  console.log('[Node Orchestrator] Registering component with hooks...');

  try {
    hooks.addContent('SiteInfoOverview', NodeAppsInfo);
    console.log('[Node Orchestrator] Successfully registered with SiteInfoOverview');
  } catch (e) {
    console.error('[Node Orchestrator] Failed to register with SiteInfoOverview:', e);
  }

  try {
    hooks.addContent('SiteInfoOverview_Bottom', NodeAppsInfo);
    console.log('[Node Orchestrator] Successfully registered with SiteInfoOverview_Bottom');
  } catch (e) {
    console.error('[Node Orchestrator] Failed to register with SiteInfoOverview_Bottom:', e);
  }

  // Register simple test component
  try {
    hooks.addContent('SiteInfoTop', SimpleTestComponent);
    console.log('[Node Orchestrator] Registered SimpleTestComponent with SiteInfoTop');
  } catch (e) {
    console.error('[Node Orchestrator] Failed to register SimpleTestComponent:', e);
  }

  // Try more hook locations to see what works
  const hookLocations = [
    'SiteInfo',
    'SiteInfoSidebar',
    'SiteDetails',
    'SiteOverview'
  ];

  hookLocations.forEach(location => {
    try {
      hooks.addContent(location, NodeAppsInfo);
      console.log(`[Node Orchestrator] Trying to register with ${location}`);
    } catch (e) {
      // Silently fail for non-existent hooks
    }
  });

  console.log('[Node Orchestrator] Renderer setup complete');
}
