/**
 * Network Monitor Service
 * 
 * Monitors network connection status and type (WiFi/cellular/ethernet).
 * Provides network status change notifications.
 */

import { net } from 'electron';
import { NetworkStatus } from '../../src/types/onedrive-sync';
import { logger } from '../utils/logger';

export class NetworkMonitor {
  private statusChangeCallbacks: Array<(status: NetworkStatus) => void> = [];
  private currentStatus: NetworkStatus;

  constructor() {
    this.currentStatus = {
      online: net.isOnline(),
      connectionType: 'unknown'
    };

    // Set up event listeners for network status changes
    this.setupEventListeners();
  }

  /**
   * Check if network is connected
   * @returns Connection status
   */
  isOnline(): boolean {
    return net.isOnline();
  }

  /**
   * Check if connection is WiFi
   * Note: Electron doesn't provide direct API to detect connection type.
   * This is a best-effort implementation using available APIs.
   * @returns WiFi status (true if WiFi, false otherwise)
   */
  async isWiFi(): Promise<boolean> {
    if (!this.isOnline()) {
      return false;
    }

    // Detect connection type
    const connectionType = await this.detectConnectionType();
    return connectionType === 'wifi';
  }

  /**
   * Get current network status
   * @returns Current network status
   */
  async getStatus(): Promise<NetworkStatus> {
    const online = this.isOnline();
    const connectionType = online ? await this.detectConnectionType() : 'unknown';
    
    this.currentStatus = { online, connectionType };
    return this.currentStatus;
  }

  /**
   * Register callback for network status changes
   * @param callback Status change callback
   */
  onStatusChange(callback: (status: NetworkStatus) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  /**
   * Remove status change callback
   * @param callback Callback to remove
   */
  removeStatusChangeListener(callback: (status: NetworkStatus) => void): void {
    const index = this.statusChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Set up event listeners for network status changes
   */
  private setupEventListeners(): void {
    // Electron's net module doesn't provide events for online/offline changes
    // We'll poll the status periodically instead
    setInterval(() => {
      const currentOnline = net.isOnline();
      if (currentOnline !== this.currentStatus.online) {
        this.handleNetworkChange(currentOnline);
      }
    }, 5000); // Check every 5 seconds

    logger.info('network', 'Network monitor initialized');
  }

  /**
   * Handle network status change
   * @param online Whether network is online
   */
  private async handleNetworkChange(online: boolean): Promise<void> {
    const connectionType = online ? await this.detectConnectionType() : 'unknown';
    
    const newStatus: NetworkStatus = {
      online,
      connectionType
    };

    // Only notify if status actually changed
    if (
      newStatus.online !== this.currentStatus.online ||
      newStatus.connectionType !== this.currentStatus.connectionType
    ) {
      this.currentStatus = newStatus;
      logger.info('network', 'Network status changed', { status: newStatus });
      
      // Notify all registered callbacks
      this.statusChangeCallbacks.forEach(callback => {
        try {
          callback(newStatus);
        } catch (error) {
          logger.error('network', 'Error in network status change callback', error as Error);
        }
      });
    }
  }

  /**
   * Detect connection type using available APIs
   * This is a best-effort implementation as Electron doesn't provide
   * direct API to detect WiFi vs cellular vs ethernet.
   * 
   * @returns Connection type
   */
  private async detectConnectionType(): Promise<NetworkStatus['connectionType']> {
    try {
      // Use Electron's net module to check if we can reach the internet
      const isReachable = await this.checkInternetReachability();
      
      if (!isReachable) {
        return 'unknown';
      }

      // On Windows and Linux, we can try to detect connection type
      // by checking network interfaces, but this requires additional
      // native modules or system calls.
      // For now, we'll default to 'unknown' and let the user configure
      // WiFi-only sync manually.
      
      // In a production implementation, you might want to:
      // 1. Use node-wifi or similar package to detect WiFi
      // 2. Use system commands (netsh on Windows, nmcli on Linux)
      // 3. Check network interface names (wlan*, eth*, etc.)
      
      return 'unknown';
    } catch (error) {
      logger.error('network', 'Error detecting connection type', error as Error);
      return 'unknown';
    }
  }

  /**
   * Check if internet is reachable by attempting to connect to a reliable host
   * @returns Whether internet is reachable
   */
  private async checkInternetReachability(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Try to reach a reliable host
        const request = net.request({
          method: 'HEAD',
          url: 'https://www.microsoft.com',
        });

        request.on('response', () => {
          resolve(true);
        });

        request.on('error', () => {
          resolve(false);
        });

        // Set timeout
        setTimeout(() => {
          request.abort();
          resolve(false);
        }, 5000);

        request.end();
      } catch (error) {
        resolve(false);
      }
    });
  }
}

// Singleton instance
let networkMonitorInstance: NetworkMonitor | null = null;

/**
 * Get the singleton NetworkMonitor instance
 * @returns NetworkMonitor instance
 */
export function getNetworkMonitor(): NetworkMonitor {
  if (!networkMonitorInstance) {
    networkMonitorInstance = new NetworkMonitor();
  }
  return networkMonitorInstance;
}
