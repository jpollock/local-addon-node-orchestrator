import React, { useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Text,
  Select,
  Checkbox,
  Title
} from '@getflywheel/local-components';

interface AddAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (app: any) => void;
}

const AddAppModal: React.FC<AddAppModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    gitUrl: '',
    branch: 'main',
    installCommand: 'npm install',
    buildCommand: '',
    startCommand: 'npm start',
    nodeVersion: '20.x',
    autoStart: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'App name is required';
    }

    if (!formData.gitUrl.trim()) {
      newErrors.gitUrl = 'Git repository URL is required';
    } else if (!isValidGitUrl(formData.gitUrl)) {
      newErrors.gitUrl = 'Invalid Git URL format';
    }

    if (!formData.branch.trim()) {
      newErrors.branch = 'Branch is required';
    }

    if (!formData.installCommand.trim()) {
      newErrors.installCommand = 'Install command is required';
    }

    if (!formData.startCommand.trim()) {
      newErrors.startCommand = 'Start command is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidGitUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/.+$/,
      /^git@.+:.+$/,
      /^ssh:\/\/.+$/
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onAdd({
      ...formData,
      env: {}
    });

    // Reset form
    setFormData({
      name: '',
      gitUrl: '',
      branch: 'main',
      installCommand: 'npm install',
      buildCommand: '',
      startCommand: 'npm start',
      nodeVersion: '20.x',
      autoStart: true
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Node.js Application"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>
            Add Application
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <Input
            label="App Name"
            value={formData.name}
            onChange={(value) => handleChange('name', value)}
            placeholder="my-node-app"
            error={errors.name}
          />
          <Text style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            A unique name for this application
          </Text>
        </div>

        <div>
          <Input
            label="Git Repository URL"
            value={formData.gitUrl}
            onChange={(value) => handleChange('gitUrl', value)}
            placeholder="https://github.com/user/repo.git"
            error={errors.gitUrl}
          />
          <Text style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            HTTPS or SSH URL to your Git repository
          </Text>
        </div>

        <div>
          <Input
            label="Branch"
            value={formData.branch}
            onChange={(value) => handleChange('branch', value)}
            placeholder="main"
            error={errors.branch}
          />
          <Text style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            The branch to clone and track
          </Text>
        </div>

        <div>
          <Select
            label="Node.js Version"
            value={formData.nodeVersion}
            onChange={(value) => handleChange('nodeVersion', value)}
            options={[
              { value: '18.x', label: 'Node.js 18.x' },
              { value: '20.x', label: 'Node.js 20.x (LTS)' },
              { value: '21.x', label: 'Node.js 21.x' }
            ]}
          />
        </div>

        <div>
          <Input
            label="Install Command"
            value={formData.installCommand}
            onChange={(value) => handleChange('installCommand', value)}
            placeholder="npm install"
            error={errors.installCommand}
          />
          <Text style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Command to install dependencies (npm install, yarn, pnpm install)
          </Text>
        </div>

        <div>
          <Input
            label="Build Command (Optional)"
            value={formData.buildCommand}
            onChange={(value) => handleChange('buildCommand', value)}
            placeholder="npm run build"
          />
          <Text style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Command to build the application (if needed)
          </Text>
        </div>

        <div>
          <Input
            label="Start Command"
            value={formData.startCommand}
            onChange={(value) => handleChange('startCommand', value)}
            placeholder="npm start"
            error={errors.startCommand}
          />
          <Text style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Command to start the application
          </Text>
        </div>

        <div>
          <Checkbox
            label="Start automatically with site"
            checked={formData.autoStart}
            onChange={(checked) => handleChange('autoStart', checked)}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddAppModal;
