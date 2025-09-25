export default function (context: any): void {
  const { React, hooks } = context;

  const NodeAppsInfo = ({ site }: any) => {
    if (!site) return null;

    class NodeAppsManager extends React.Component<any, any> {
      state = { testResult: '' };

      testIPC = async () => {
        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:test', {
            siteId: site.id
          });
          this.setState({ testResult: JSON.stringify(response) });
        } catch (error: any) {
          this.setState({ testResult: `Error: ${error.message}` });
        }
      };

      render() {
        return React.createElement(
          'div',
          { style: { padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', marginTop: '20px' } },
          React.createElement('h3', null, '🚀 Node.js Orchestrator'),
          React.createElement('p', null, `Site: ${this.props.site.name}`),
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

  hooks.addContent('SiteInfoOverview', NodeAppsInfo);
  hooks.addContent('SiteInfoOverview_Bottom', NodeAppsInfo);
}