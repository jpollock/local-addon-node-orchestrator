/**
 * PortManager - Handles port allocation for Node.js apps
 * Ensures each app gets a unique port to avoid conflicts
 */

import * as fs from 'fs-extra';
import * as path from 'path';

export interface PortAllocation {
  appId: string;
  port: number;
  allocatedAt: Date;
}

export class PortManager {
  private static readonly DEFAULT_START_PORT = 3000;
  private static readonly DEFAULT_END_PORT = 3999;
  private static readonly PORT_ALLOCATION_FILE = 'port-allocations.json';

  /**
   * Get the next available port for a site
   */
  async getNextAvailablePort(sitePath: string, excludeAppId?: string): Promise<number> {
    const allocations = await this.getAllocations(sitePath);

    // Filter out the app we're updating (if any)
    const activeAllocations = excludeAppId
      ? allocations.filter(a => a.appId !== excludeAppId)
      : allocations;

    // Find all used ports
    const usedPorts = new Set(activeAllocations.map(a => a.port));

    // Find first available port
    for (let port = PortManager.DEFAULT_START_PORT; port <= PortManager.DEFAULT_END_PORT; port++) {
      if (!usedPorts.has(port)) {
        return port;
      }
    }

    throw new Error('No available ports in range 3000-3999');
  }

  /**
   * Allocate a port for an app
   */
  async allocatePort(sitePath: string, appId: string, requestedPort?: number): Promise<number> {
    const allocations = await this.getAllocations(sitePath);

    // Remove any existing allocation for this app
    const filteredAllocations = allocations.filter(a => a.appId !== appId);

    let port: number;

    if (requestedPort) {
      // Check if requested port is available
      const portInUse = filteredAllocations.some(a => a.port === requestedPort);
      if (portInUse) {
        throw new Error(`Port ${requestedPort} is already in use`);
      }
      port = requestedPort;
    } else {
      // Get next available port
      port = await this.getNextAvailablePort(sitePath, appId);
    }

    // Add new allocation
    filteredAllocations.push({
      appId,
      port,
      allocatedAt: new Date()
    });

    await this.saveAllocations(sitePath, filteredAllocations);
    return port;
  }

  /**
   * Release a port allocation
   */
  async releasePort(sitePath: string, appId: string): Promise<void> {
    const allocations = await this.getAllocations(sitePath);
    const filtered = allocations.filter(a => a.appId !== appId);
    await this.saveAllocations(sitePath, filtered);
  }

  /**
   * Get port for a specific app
   */
  async getPortForApp(sitePath: string, appId: string): Promise<number | undefined> {
    const allocations = await this.getAllocations(sitePath);
    const allocation = allocations.find(a => a.appId === appId);
    return allocation?.port;
  }

  /**
   * Get all port allocations for a site
   */
  private async getAllocations(sitePath: string): Promise<PortAllocation[]> {
    const allocFile = this.getAllocationFilePath(sitePath);

    try {
      if (await fs.pathExists(allocFile)) {
        const data = await fs.readJson(allocFile);
        return data.allocations || [];
      }
    } catch (error) {
      console.error('[PortManager] Error reading allocations:', error);
    }

    return [];
  }

  /**
   * Save port allocations
   */
  private async saveAllocations(sitePath: string, allocations: PortAllocation[]): Promise<void> {
    const allocFile = this.getAllocationFilePath(sitePath);
    await fs.ensureDir(path.dirname(allocFile));
    await fs.writeJson(allocFile, { allocations }, { spaces: 2 });
  }

  /**
   * Get the path to the port allocation file
   */
  private getAllocationFilePath(sitePath: string): string {
    // Expand ~ if present
    const absoluteSitePath = sitePath.startsWith('~')
      ? path.join(process.env.HOME || '', sitePath.slice(1))
      : sitePath;

    return path.join(absoluteSitePath, 'conf', 'node-apps', PortManager.PORT_ALLOCATION_FILE);
  }

  /**
   * Clean up all allocations for a site (used when site is deleted)
   */
  async cleanupAllocations(sitePath: string): Promise<void> {
    const allocFile = this.getAllocationFilePath(sitePath);
    if (await fs.pathExists(allocFile)) {
      await fs.remove(allocFile);
    }
  }
}
