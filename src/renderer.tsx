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
      state = {
        testResult: '',
        showForm: false,
        editingAppId: null,
        loading: false,
        apps: [],
        showLogsFor: null,
        logs: '',
        formData: {
          name: '',
          gitUrl: '',
          branch: 'main',
          installCommand: '',
          buildCommand: '',
          startCommand: 'npm start',
          nodeVersion: '20.x',
          autoStart: false
        }
      };

      refreshInterval: any = null;

      componentDidMount() {
        this.loadApps();
        // Auto-refresh every 2 seconds to catch status updates
        this.refreshInterval = setInterval(() => {
          this.loadApps();
        }, 2000);
      }

      componentWillUnmount() {
        if (this.refreshInterval) {
          clearInterval(this.refreshInterval);
        }
      }

      loadApps = async () => {
        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:get-apps', {
            siteId: site.id
          });

          if (response.success) {
            this.setState({ apps: response.apps || [] });
          }
        } catch (error: any) {
          console.error('Failed to load apps:', error);
        }
      };

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

      handleInputChange = (field: string, value: any) => {
        this.setState({
          formData: { ...this.state.formData, [field]: value }
        });
      };

      handleAddApp = async (e: any) => {
        e.preventDefault();
        this.setState({ loading: true, testResult: '' });

        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:add-app', {
            siteId: site.id,
            app: this.state.formData
          });

          if (response.success) {
            this.setState({
              testResult: `✅ App "${response.app.name}" added successfully!`,
              showForm: false,
              formData: {
                name: '',
                gitUrl: '',
                branch: 'main',
                installCommand: '',
                buildCommand: '',
                startCommand: 'npm start',
                nodeVersion: '20.x',
                autoStart: false
              }
            });
            await this.loadApps();
          } else {
            this.setState({ testResult: `❌ Failed to add app: ${response.error}` });
          }
        } catch (error: any) {
          this.setState({ testResult: `❌ Error: ${error.message}` });
        } finally {
          this.setState({ loading: false });
        }
      };

      handleStartApp = async (appId: string) => {
        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:start-app', {
            siteId: site.id,
            appId
          });

          if (response.success) {
            this.setState({ testResult: `✅ App started successfully!` });
            await this.loadApps();
          } else {
            this.setState({ testResult: `❌ Failed to start: ${response.error}` });
          }
        } catch (error: any) {
          this.setState({ testResult: `❌ Error: ${error.message}` });
        }
      };

      handleStopApp = async (appId: string) => {
        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:stop-app', {
            siteId: site.id,
            appId
          });

          if (response.success) {
            this.setState({ testResult: `✅ App stopped successfully!` });
            await this.loadApps();
          } else {
            this.setState({ testResult: `❌ Failed to stop: ${response.error}` });
          }
        } catch (error: any) {
          this.setState({ testResult: `❌ Error: ${error.message}` });
        }
      };

      handleRemoveApp = async (appId: string, appName: string) => {
        if (!confirm(`Are you sure you want to remove "${appName}"?`)) {
          return;
        }

        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:remove-app', {
            siteId: site.id,
            appId
          });

          if (response.success) {
            this.setState({ testResult: `✅ App removed successfully!` });
            await this.loadApps();
          } else {
            this.setState({ testResult: `❌ Failed to remove: ${response.error}` });
          }
        } catch (error: any) {
          this.setState({ testResult: `❌ Error: ${error.message}` });
        }
      };

      handleEditApp = (app: any) => {
        this.setState({
          editingAppId: app.id,
          showForm: true,
          formData: {
            name: app.name,
            gitUrl: app.gitUrl,
            branch: app.branch,
            installCommand: app.installCommand,
            buildCommand: app.buildCommand || '',
            startCommand: app.startCommand,
            nodeVersion: app.nodeVersion,
            autoStart: app.autoStart
          }
        });
      };

      handleUpdateApp = async (e: any) => {
        e.preventDefault();
        this.setState({ loading: true, testResult: '' });

        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:update-app', {
            siteId: site.id,
            appId: this.state.editingAppId,
            updates: this.state.formData
          });

          if (response.success) {
            this.setState({
              testResult: `✅ App "${response.app.name}" updated successfully!`,
              showForm: false,
              editingAppId: null,
              formData: {
                name: '',
                gitUrl: '',
                branch: 'main',
                installCommand: '',
                buildCommand: '',
                startCommand: 'npm start',
                nodeVersion: '20.x',
                autoStart: false
              }
            });
            await this.loadApps();
          } else {
            this.setState({ testResult: `❌ Failed to update app: ${response.error}` });
          }
        } catch (error: any) {
          this.setState({ testResult: `❌ Error: ${error.message}` });
        } finally {
          this.setState({ loading: false });
        }
      };

      handleCancelEdit = () => {
        this.setState({
          showForm: false,
          editingAppId: null,
          formData: {
            name: '',
            gitUrl: '',
            branch: 'main',
            installCommand: '',
            buildCommand: '',
            startCommand: 'npm start',
            nodeVersion: '20.x',
            autoStart: false
          }
        });
      };

      handleViewLogs = async (appId: string) => {
        try {
          const electron = context.electron || (window as any).electron;
          const response = await electron.ipcRenderer.invoke('node-orchestrator:get-logs', {
            siteId: site.id,
            appId,
            lines: 100
          });

          if (response.success) {
            this.setState({
              showLogsFor: appId,
              logs: response.logs || 'No logs available yet.'
            });
          } else {
            this.setState({ testResult: `❌ Failed to get logs: ${response.error}` });
          }
        } catch (error: any) {
          this.setState({ testResult: `❌ Error: ${error.message}` });
        }
      };

      handleCloseLogs = () => {
        this.setState({ showLogsFor: null, logs: '' });
      };

      render() {
        const { name, domain } = this.props.site;
        const { showForm, testResult } = this.state;

        return React.createElement(
          'div',
          { style: { padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', marginTop: '20px' } },
          React.createElement('h3', null, '🚀 Node.js Orchestrator'),
          React.createElement('p', { style: { marginBottom: '15px', color: '#666' } }, `Site: ${name} (${domain})`),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '10px', marginBottom: '15px' } },
            React.createElement('button', {
              onClick: this.testIPC,
              style: { padding: '8px 16px', backgroundColor: '#007cba', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }
            }, 'Test Connection'),
            React.createElement('button', {
              onClick: this.loadApps,
              style: { padding: '8px 16px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }
            }, 'Refresh'),
            React.createElement('button', {
              onClick: () => showForm ? this.handleCancelEdit() : this.setState({ showForm: true, editingAppId: null }),
              style: { padding: '8px 16px', backgroundColor: '#00a32a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }
            }, showForm ? 'Cancel' : 'Add Node.js App')
          ),
          testResult && React.createElement('div', {
            style: { marginBottom: '15px', padding: '10px', backgroundColor: testResult.includes('✅') ? '#d7f8d7' : '#f8d7da', borderRadius: '4px', fontSize: '14px' }
          }, testResult),
          showForm && this.renderForm(),
          this.renderAppsList()
        );
      }

      renderForm() {
        const { formData, loading, editingAppId } = this.state;
        const isEditing = editingAppId !== null;

        return React.createElement('form', {
          onSubmit: isEditing ? this.handleUpdateApp : this.handleAddApp,
          style: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd' }
        },
          React.createElement('h4', { style: { marginTop: 0 } }, isEditing ? 'Edit Node.js App' : 'Add New Node.js App'),
          this.renderInput('App Name *', 'name', formData.name, 'my-app', true, 'Lowercase, numbers, dashes only'),
          this.renderInput('Git Repository URL *', 'gitUrl', formData.gitUrl, 'https://github.com/user/repo.git', true),
          this.renderInput('Branch', 'branch', formData.branch, 'main'),
          this.renderSelect('Node Version', 'nodeVersion', formData.nodeVersion, [
            { value: '18.x', label: 'Node.js 18.x' },
            { value: '20.x', label: 'Node.js 20.x' },
            { value: '21.x', label: 'Node.js 21.x' },
            { value: '22.x', label: 'Node.js 22.x' }
          ]),
          this.renderInput('Install Command', 'installCommand', formData.installCommand, 'Auto-detected', false, 'Leave empty to auto-detect'),
          this.renderInput('Build Command', 'buildCommand', formData.buildCommand, 'npm run build (optional)'),
          this.renderInput('Start Command', 'startCommand', formData.startCommand, 'npm start'),
          React.createElement('div', { style: { marginBottom: '15px' } },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              React.createElement('input', {
                type: 'checkbox',
                checked: formData.autoStart,
                onChange: (e: any) => this.handleInputChange('autoStart', e.target.checked)
              }),
              'Auto-start when site starts'
            )
          ),
          React.createElement('div', { style: { display: 'flex', gap: '10px' } },
            React.createElement('button', {
              type: 'submit',
              disabled: loading,
              style: { padding: '10px 20px', backgroundColor: loading ? '#ccc' : '#00a32a', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' }
            }, loading ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update App' : 'Add App')),
            React.createElement('button', {
              type: 'button',
              onClick: this.handleCancelEdit,
              disabled: loading,
              style: { padding: '10px 20px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' }
            }, 'Cancel')
          )
        );
      }

      renderInput(label: string, field: string, value: string, placeholder: string, required = false, helpText?: string) {
        return React.createElement('div', { style: { marginBottom: '15px' } },
          React.createElement('label', { style: { display: 'block', marginBottom: '5px', fontWeight: 'bold' } }, label),
          React.createElement('input', {
            type: 'text',
            value: value,
            onChange: (e: any) => this.handleInputChange(field, e.target.value),
            placeholder: placeholder,
            required: required,
            style: { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }
          }),
          helpText && React.createElement('small', { style: { color: '#666' } }, helpText)
        );
      }

      renderSelect(label: string, field: string, value: string, options: { value: string; label: string }[]) {
        return React.createElement('div', { style: { marginBottom: '15px' } },
          React.createElement('label', { style: { display: 'block', marginBottom: '5px', fontWeight: 'bold' } }, label),
          React.createElement('select', {
            value: value,
            onChange: (e: any) => this.handleInputChange(field, e.target.value),
            style: { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }
          }, options.map(opt => React.createElement('option', { key: opt.value, value: opt.value }, opt.label)))
        );
      }

      renderAppsList() {
        const { apps } = this.state;
        return React.createElement('div', null,
          React.createElement('h4', null, `Configured Apps (${apps.length})`),
          apps.length === 0
            ? React.createElement('p', { style: { color: '#666', fontStyle: 'italic' } }, 'No apps configured yet.')
            : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                apps.map((app: any) => React.createElement('div', {
                  key: app.id,
                  style: { backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }
                },
                  React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } },
                    React.createElement('strong', { style: { fontSize: '16px' } }, app.name),
                    React.createElement('span', {
                      style: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: app.status === 'running' ? '#d7f8d7' : '#f0f0f0', color: app.status === 'running' ? '#00a32a' : '#666' }
                    }, app.status)
                  ),
                  React.createElement('div', { style: { fontSize: '13px', color: '#666', marginBottom: '10px' } },
                    React.createElement('div', null, `Git: ${app.gitUrl}`),
                    React.createElement('div', null, `Branch: ${app.branch}`),
                    React.createElement('div', null, `Node: ${app.nodeVersion}`),
                    app.port && React.createElement('div', { style: { marginTop: '5px' } },
                      'Port: ',
                      app.status === 'running'
                        ? React.createElement('a', {
                            href: `http://localhost:${app.port}`,
                            target: '_blank',
                            style: { color: '#007cba', textDecoration: 'none', fontWeight: 'bold' }
                          }, `${app.port} (click to open)`)
                        : React.createElement('span', { style: { fontWeight: 'bold' } }, app.port)
                    )
                  ),
                  React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
                    app.status === 'stopped' && React.createElement('button', {
                      onClick: () => this.handleStartApp(app.id),
                      style: { padding: '6px 12px', backgroundColor: '#00a32a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }
                    }, 'Start'),
                    app.status === 'running' && React.createElement('button', {
                      onClick: () => this.handleStopApp(app.id),
                      style: { padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }
                    }, 'Stop'),
                    React.createElement('button', {
                      onClick: () => this.handleViewLogs(app.id),
                      style: { padding: '6px 12px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }
                    }, 'View Logs'),
                    React.createElement('button', {
                      onClick: () => this.handleEditApp(app),
                      style: { padding: '6px 12px', backgroundColor: '#007cba', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }
                    }, 'Edit'),
                    React.createElement('button', {
                      onClick: () => this.handleRemoveApp(app.id, app.name),
                      style: { padding: '6px 12px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }
                    }, 'Remove')
                  ),
                  this.state.showLogsFor === app.id && this.renderLogsViewer(app.name)
                ))
              )
        );
      }

      renderLogsViewer(appName: string) {
        return React.createElement('div', {
          style: {
            marginTop: '15px',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            position: 'relative'
          }
        },
          React.createElement('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }
          },
            React.createElement('strong', { style: { color: '#569cd6' } }, `Logs for ${appName}`),
            React.createElement('button', {
              onClick: this.handleCloseLogs,
              style: { padding: '4px 8px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }
            }, 'Close')
          ),
          React.createElement('pre', {
            style: { margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }
          }, this.state.logs)
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