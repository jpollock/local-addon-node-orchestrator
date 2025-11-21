import React from 'react';
import {
  Card,
  Button,
  Text,
  Title,
  Icon
} from '@getflywheel/local-components';
import { NodeApp, NodeAppStatus } from '../types';

interface AppCardProps {
  app: NodeApp;
  site: any;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onViewLogs: () => void;
}

class AppCard extends React.Component<AppCardProps> {
  getStatusColor(status: NodeAppStatus): string {
    switch (status) {
      case 'running':
        return '#28a745';
      case 'stopped':
        return '#6c757d';
      case 'error':
        return '#dc3545';
      case 'starting':
      case 'stopping':
      case 'installing':
      case 'building':
      case 'cloning':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  }

  getStatusIcon(status: NodeAppStatus): string {
    switch (status) {
      case 'running':
        return 'check-circle';
      case 'stopped':
        return 'stop-circle';
      case 'error':
        return 'exclamation-circle';
      case 'starting':
      case 'stopping':
      case 'installing':
      case 'building':
      case 'cloning':
        return 'spinner';
      default:
        return 'question-circle';
    }
  }

  render() {
    const { app, site, onStart, onStop, onRemove, onViewLogs } = this.props;
    const appUrl = app.port ? `http://localhost:${app.port}` : null;

    return (
    <Card>
      <div style={{ padding: '15px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Title level={3} style={{ margin: 0 }}>{app.name}</Title>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: `${getStatusColor(app.status)}20`,
              color: getStatusColor(app.status)
            }}>
              <Icon name={getStatusIcon(app.status)} />
              <Text style={{ 
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {app.status}
              </Text>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {app.status === 'stopped' && (
              <Button
                variant="primary"
                size="small"
                onClick={onStart}
              >
                Start
              </Button>
            )}
            {app.status === 'running' && (
              <Button
                variant="secondary"
                size="small"
                onClick={onStop}
              >
                Stop
              </Button>
            )}
            <Button
              variant="ghost"
              size="small"
              onClick={onViewLogs}
            >
              Logs
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={onRemove}
            >
              Remove
            </Button>
          </div>
        </div>

        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          fontSize: '14px'
        }}>
          <div>
            <Text style={{ color: '#666' }}>Repository:</Text>
            <Text style={{ fontFamily: 'monospace' }}>{app.gitUrl}</Text>
          </div>
          <div>
            <Text style={{ color: '#666' }}>Branch:</Text>
            <Text>{app.branch}</Text>
          </div>
          <div>
            <Text style={{ color: '#666' }}>Node Version:</Text>
            <Text>{app.nodeVersion}</Text>
          </div>
          <div>
            <Text style={{ color: '#666' }}>Port:</Text>
            {app.port ? (
              <a 
                href={appUrl!} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#007bff' }}
              >
                {app.port} →
              </a>
            ) : (
              <Text>Not allocated</Text>
            )}
          </div>
        </div>

        {app.lastError && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#dc354520',
            borderRadius: '4px',
            border: '1px solid #dc3545'
          }}>
            <Text style={{ color: '#dc3545', fontSize: '13px' }}>
              <strong>Error:</strong> {app.lastError}
            </Text>
          </div>
        )}

        {app.status === 'running' && app.startedAt && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px'
          }}>
            <Text style={{ fontSize: '13px', color: '#666' }}>
              Running since: {new Date(app.startedAt).toLocaleString()}
            </Text>
            {app.pid && (
              <Text style={{ fontSize: '13px', color: '#666' }}>
                Process ID: {app.pid}
              </Text>
            )}
          </div>
        )}

        <div style={{
          marginTop: '15px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <Text style={{ fontSize: '12px', color: '#666' }}>
            <strong>Install:</strong> {app.installCommand}
          </Text>
          {app.buildCommand && (
            <Text style={{ fontSize: '12px', color: '#666' }}>
              <strong>Build:</strong> {app.buildCommand}
            </Text>
          )}
          <Text style={{ fontSize: '12px', color: '#666' }}>
            <strong>Start:</strong> {app.startCommand}
          </Text>
        </div>
      </div>
    </Card>
    );
  }
}

export default AppCard;
