import React from 'react';
import {
  Button,
  Title,
  Text,
  Card,
  Spinner,
  Banner,
  Modal
} from '@getflywheel/local-components';
import { NodeApp, NodeAppStatus } from '../types';
import AddAppModal from './AddAppModal';
import AppCard from './AppCard';
import AppLogs from './AppLogs';

interface NodeAppsTabProps {
  site: any;
  electron: any;
}

interface NodeAppsTabState {
  apps: NodeApp[];
  loading: boolean;
  error: string | null;
  showAddModal: boolean;
  selectedApp: NodeApp | null;
  showLogs: boolean;
}

class NodeAppsTab extends React.Component<NodeAppsTabProps, NodeAppsTabState> {
  private refreshInterval?: NodeJS.Timeout;

  state: NodeAppsTabState = {
    apps: [],
    loading: true,
    error: null,
    showAddModal: false,
    selectedApp: null,
    showLogs: false
  };

  componentDidMount() {
    this.loadApps();

    // Set up refresh interval
    this.refreshInterval = setInterval(() => this.loadApps(), 5000);
  }

  componentWillUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadApps = async () => {
    try {
      const response = await this.props.electron.ipcRenderer.invoke(
        'node-orchestrator:get-apps',
        { siteId: this.props.site.id }
      );

      if (response.success) {
        this.setState({ apps: response.apps || [], error: null });
      } else {
        this.setState({ error: response.error || 'Failed to load apps' });
      }
    } catch (err: any) {
      this.setState({ error: err.message });
    } finally {
      this.setState({ loading: false });
    }
  };

  handleAddApp = async (appConfig: any) => {
    try {
      const response = await this.props.electron.ipcRenderer.invoke(
        'node-orchestrator:add-app',
        {
          siteId: this.props.site.id,
          app: appConfig
        }
      );

      if (response.success) {
        await this.loadApps();
        this.setState({ showAddModal: false });
      } else {
        throw new Error(response.error);
      }
    } catch (err: any) {
      alert(`Failed to add app: ${err.message}`);
    }
  };

  handleStartApp = async (appId: string) => {
    try {
      const response = await this.props.electron.ipcRenderer.invoke(
        'node-orchestrator:start-app',
        { siteId: this.props.site.id, appId }
      );

      if (response.success) {
        await this.loadApps();
      } else {
        throw new Error(response.error);
      }
    } catch (err: any) {
      alert(`Failed to start app: ${err.message}`);
    }
  };

  handleStopApp = async (appId: string) => {
    try {
      const response = await this.props.electron.ipcRenderer.invoke(
        'node-orchestrator:stop-app',
        { siteId: this.props.site.id, appId }
      );

      if (response.success) {
        await this.loadApps();
      } else {
        throw new Error(response.error);
      }
    } catch (err: any) {
      alert(`Failed to stop app: ${err.message}`);
    }
  };

  handleRemoveApp = async (appId: string) => {
    if (!confirm('Are you sure you want to remove this app?')) {
      return;
    }

    try {
      const response = await this.props.electron.ipcRenderer.invoke(
        'node-orchestrator:remove-app',
        { siteId: this.props.site.id, appId }
      );

      if (response.success) {
        await this.loadApps();
      } else {
        throw new Error(response.error);
      }
    } catch (err: any) {
      alert(`Failed to remove app: ${err.message}`);
    }
  };

  handleViewLogs = (app: NodeApp) => {
    this.setState({ selectedApp: app, showLogs: true });
  };

  render() {
    const { apps, loading, error, showAddModal, selectedApp, showLogs } = this.state;
    const { site, electron } = this.props;

    if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Spinner />
        <Text>Loading Node.js apps...</Text>
      </div>
    );
  }

    if (error) {
      return (
        <div style={{ padding: '20px' }}>
          <Banner variant="error">
            {error}
            <Button onClick={this.loadApps} size="small">Retry</Button>
          </Banner>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <Title level={2}>Node.js Applications</Title>
          <Button
            variant="primary"
            onClick={() => this.setState({ showAddModal: true })}
          >
            Add Node.js App
          </Button>
        </div>

        {apps.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Text>No Node.js apps configured for this site.</Text>
              <br />
              <Button
                variant="primary"
                onClick={() => this.setState({ showAddModal: true })}
                style={{ marginTop: '20px' }}
              >
                Add Your First App
              </Button>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {apps.map(app => (
              <AppCard
                key={app.id}
                app={app}
                onStart={() => this.handleStartApp(app.id)}
                onStop={() => this.handleStopApp(app.id)}
                onRemove={() => this.handleRemoveApp(app.id)}
                onViewLogs={() => this.handleViewLogs(app)}
                site={site}
              />
            ))}
          </div>
        )}

        {showAddModal && (
          <AddAppModal
            isOpen={showAddModal}
            onClose={() => this.setState({ showAddModal: false })}
            onAdd={this.handleAddApp}
          />
        )}

        {showLogs && selectedApp && (
          <AppLogs
            isOpen={showLogs}
            onClose={() => this.setState({ showLogs: false })}
            app={selectedApp}
            siteId={site.id}
            electron={electron}
          />
        )}
      </div>
    );
  }
}

export default NodeAppsTab;
