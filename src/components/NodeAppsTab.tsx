import React, { useState, useEffect } from 'react';
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

const NodeAppsTab: React.FC<NodeAppsTabProps> = ({ site, electron }) => {
  const [apps, setApps] = useState<NodeApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<NodeApp | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadApps();
    
    // Set up refresh interval
    const interval = setInterval(loadApps, 5000);
    return () => clearInterval(interval);
  }, [site.id]);

  const loadApps = async () => {
    try {
      const response = await electron.ipcRenderer.invoke(
        'node-orchestrator:get-apps',
        { siteId: site.id }
      );

      if (response.success) {
        setApps(response.apps || []);
        setError(null);
      } else {
        setError(response.error || 'Failed to load apps');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddApp = async (appConfig: any) => {
    try {
      const response = await electron.ipcRenderer.invoke(
        'node-orchestrator:add-app',
        {
          siteId: site.id,
          app: appConfig
        }
      );

      if (response.success) {
        await loadApps();
        setShowAddModal(false);
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      alert(`Failed to add app: ${err.message}`);
    }
  };

  const handleStartApp = async (appId: string) => {
    try {
      const response = await electron.ipcRenderer.invoke(
        'node-orchestrator:start-app',
        { siteId: site.id, appId }
      );

      if (response.success) {
        await loadApps();
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      alert(`Failed to start app: ${err.message}`);
    }
  };

  const handleStopApp = async (appId: string) => {
    try {
      const response = await electron.ipcRenderer.invoke(
        'node-orchestrator:stop-app',
        { siteId: site.id, appId }
      );

      if (response.success) {
        await loadApps();
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      alert(`Failed to stop app: ${err.message}`);
    }
  };

  const handleRemoveApp = async (appId: string) => {
    if (!confirm('Are you sure you want to remove this app?')) {
      return;
    }

    try {
      const response = await electron.ipcRenderer.invoke(
        'node-orchestrator:remove-app',
        { siteId: site.id, appId }
      );

      if (response.success) {
        await loadApps();
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      alert(`Failed to remove app: ${err.message}`);
    }
  };

  const handleViewLogs = (app: NodeApp) => {
    setSelectedApp(app);
    setShowLogs(true);
  };

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
          <Button onClick={loadApps} size="small">Retry</Button>
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
          onClick={() => setShowAddModal(true)}
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
              onClick={() => setShowAddModal(true)}
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
              onStart={() => handleStartApp(app.id)}
              onStop={() => handleStopApp(app.id)}
              onRemove={() => handleRemoveApp(app.id)}
              onViewLogs={() => handleViewLogs(app)}
              site={site}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddAppModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddApp}
        />
      )}

      {showLogs && selectedApp && (
        <AppLogs
          isOpen={showLogs}
          onClose={() => setShowLogs(false)}
          app={selectedApp}
          siteId={site.id}
          electron={electron}
        />
      )}
    </div>
  );
};

export default NodeAppsTab;
