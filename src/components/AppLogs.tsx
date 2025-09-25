import React, { useState, useEffect, useRef } from 'react';
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

const AppLogs: React.FC<AppLogsProps> = ({
  isOpen,
  onClose,
  app,
  siteId,
  electron
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      const interval = setInterval(loadLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, app.id]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const loadLogs = async () => {
    try {
      const response = await electron.ipcRenderer.invoke(
        'node-orchestrator:get-logs',
        {
          siteId,
          appId: app.id,
          lines: 500
        }
      );

      if (response.success) {
        setLogs(response.logs || []);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleCopyLogs = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText);
  };

  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setAutoScroll(isAtBottom);
  };

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
              onClick={handleClearLogs}
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={handleCopyLogs}
            >
              Copy All
            </Button>
            <Button
              variant={autoScroll ? 'primary' : 'secondary'}
              size="small"
              onClick={() => setAutoScroll(!autoScroll)}
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
        ref={logsContainerRef}
        onScroll={handleScroll}
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
            <div ref={logsEndRef} />
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
};

export default AppLogs;
