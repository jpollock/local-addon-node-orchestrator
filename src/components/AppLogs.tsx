import React from 'react';
import {
  Modal,
  Button,
  Text,
  Spinner
} from '@getflywheel/local-components';
import { NodeApp } from '../types';

interface AppLogsProps {
  isOpen: boolean;
  onClose: () => void;
  app: NodeApp;
  siteId: string;
  electron: any;
}

interface AppLogsState {
  logs: string[];
  loading: boolean;
  autoScroll: boolean;
}

class AppLogs extends React.Component<AppLogsProps, AppLogsState> {
  private logsEndRef: HTMLDivElement | null = null;
  private logsContainerRef: HTMLDivElement | null = null;
  private refreshInterval?: NodeJS.Timeout;

  state: AppLogsState = {
    logs: [],
    loading: true,
    autoScroll: true
  };

  componentDidMount() {
    if (this.props.isOpen) {
      this.loadLogs();
      this.refreshInterval = setInterval(() => this.loadLogs(), 2000);
    }
  }

  componentDidUpdate(prevProps: AppLogsProps, prevState: AppLogsState) {
    // Handle isOpen changes
    if (this.props.isOpen && !prevProps.isOpen) {
      this.loadLogs();
      this.refreshInterval = setInterval(() => this.loadLogs(), 2000);
    } else if (!this.props.isOpen && prevProps.isOpen) {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }
    }

    // Handle auto-scroll
    if (
      (this.state.logs !== prevState.logs || this.state.autoScroll !== prevState.autoScroll) &&
      this.state.autoScroll &&
      this.logsEndRef
    ) {
      this.logsEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  }

  componentWillUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadLogs = async () => {
    try {
      const response = await this.props.electron.ipcRenderer.invoke(
        'node-orchestrator:get-logs',
        {
          siteId: this.props.siteId,
          appId: this.props.app.id,
          lines: 500
        }
      );

      if (response.success) {
        this.setState({ logs: response.logs || [] });
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      this.setState({ loading: false });
    }
  };

  handleClearLogs = () => {
    this.setState({ logs: [] });
  };

  handleCopyLogs = () => {
    const logText = this.state.logs.join('\n');
    navigator.clipboard.writeText(logText);
  };

  handleScroll = () => {
    if (!this.logsContainerRef) return;

    const { scrollTop, scrollHeight, clientHeight } = this.logsContainerRef;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    this.setState({ autoScroll: isAtBottom });
  };

  render() {
    const { isOpen, onClose, app } = this.props;
    const { logs, loading, autoScroll } = this.state;

    return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Logs: ${app.name}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              size="small"
              onClick={this.handleClearLogs}
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={this.handleCopyLogs}
            >
              Copy All
            </Button>
            <Button
              variant={autoScroll ? 'primary' : 'secondary'}
              size="small"
              onClick={() => this.setState({ autoScroll: !autoScroll })}
            >
              Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
            </Button>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
      style={{ width: '80vw', maxWidth: '1200px' }}
    >
      <div
        ref={(ref) => (this.logsContainerRef = ref)}
        onScroll={this.handleScroll}
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.5',
          padding: '15px',
          borderRadius: '4px',
          height: '500px',
          overflowY: 'auto',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spinner />
            <Text style={{ color: '#d4d4d4' }}>Loading logs...</Text>
          </div>
        ) : logs.length === 0 ? (
          <Text style={{ color: '#666' }}>No logs available</Text>
        ) : (
          <>
            {logs.map((line, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '2px',
                  color: line.includes('[ERROR]') || line.includes('[stderr]')
                    ? '#f48771'
                    : line.includes('[WARN]')
                    ? '#dcdcaa'
                    : line.includes('[INFO]')
                    ? '#4ec9b0'
                    : '#d4d4d4'
                }}
              >
                <span style={{ color: '#666', marginRight: '10px' }}>
                  {String(index + 1).padStart(4, '0')}
                </span>
                {line}
              </div>
            ))}
            <div ref={(ref) => (this.logsEndRef = ref)} />
          </>
        )}
      </div>

      <div style={{
        marginTop: '10px',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Text style={{ fontSize: '12px', color: '#666' }}>
          Status: <strong>{app.status}</strong>
        </Text>
        {app.port && (
          <Text style={{ fontSize: '12px', color: '#666' }}>
            Port: <strong>{app.port}</strong>
          </Text>
        )}
        {app.pid && (
          <Text style={{ fontSize: '12px', color: '#666' }}>
            PID: <strong>{app.pid}</strong>
          </Text>
        )}
        <Text style={{ fontSize: '12px', color: '#666' }}>
          Lines: <strong>{logs.length}</strong>
        </Text>
      </div>
    </Modal>
    );
  }
}

export default AppLogs;
