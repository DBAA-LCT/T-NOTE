/**
 * Logging System for OneDrive Sync
 * 
 * Provides structured logging with different levels and categories.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'auth' | 'sync' | 'network' | 'api' | 'filesystem' | 'validation' | 'conflict' | 'general';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, any>;
}

class Logger {
  private logFilePath: string;
  private logQueue: LogEntry[] = [];
  private isWriting: boolean = false;
  private minLevel: LogLevel;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.logFilePath = path.join(userDataPath, 'onedrive-sync.log');
    
    // Set minimum log level based on environment
    this.minLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    
    // Initialize log file
    this.initLogFile();
  }

  private async initLogFile(): Promise<void> {
    try {
      // Check if log file exists
      await fs.access(this.logFilePath);
      
      // Check file size and rotate if necessary (> 10MB)
      const stats = await fs.stat(this.logFilePath);
      if (stats.size > 10 * 1024 * 1024) {
        await this.rotateLogFile();
      }
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(this.logFilePath, '', 'utf-8');
    }
  }

  private async rotateLogFile(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = this.logFilePath.replace('.log', `-${timestamp}.log`);
      await fs.rename(this.logFilePath, archivePath);
      await fs.writeFile(this.logFilePath, '', 'utf-8');
      
      // Keep only last 5 archived logs
      await this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const logDir = path.dirname(this.logFilePath);
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter(f => f.startsWith('onedrive-sync-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(logDir, f),
        }));

      if (logFiles.length > 5) {
        // Sort by name (which includes timestamp) and delete oldest
        logFiles.sort((a, b) => a.name.localeCompare(b.name));
        const toDelete = logFiles.slice(0, logFiles.length - 5);
        
        for (const file of toDelete) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const category = entry.category.padEnd(12);
    
    let logLine = `[${timestamp}] ${level} [${category}] ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      logLine += ` | Context: ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      logLine += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        logLine += `\n  Stack: ${entry.error.stack}`;
      }
    }
    
    return logLine;
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    this.logQueue.push(entry);
    
    if (this.isWriting) {
      return;
    }
    
    this.isWriting = true;
    
    while (this.logQueue.length > 0) {
      const entries = this.logQueue.splice(0, 10); // Write in batches
      const logLines = entries.map(e => this.formatLogEntry(e)).join('\n') + '\n';
      
      try {
        await fs.appendFile(this.logFilePath, logLines, 'utf-8');
      } catch (error) {
        console.error('Failed to write log:', error);
      }
    }
    
    this.isWriting = false;
  }

  private log(level: LogLevel, category: LogCategory, message: string, error?: Error, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Write to file
    this.writeLog(entry);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      consoleMethod(this.formatLogEntry(entry));
    }
  }

  debug(category: LogCategory, message: string, context?: Record<string, any>): void {
    this.log('debug', category, message, undefined, context);
  }

  info(category: LogCategory, message: string, context?: Record<string, any>): void {
    this.log('info', category, message, undefined, context);
  }

  warn(category: LogCategory, message: string, error?: Error, context?: Record<string, any>): void {
    this.log('warn', category, message, error, context);
  }

  error(category: LogCategory, message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', category, message, error, context);
  }

  async getLogs(lines: number = 100): Promise<string> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim());
      const recentLines = allLines.slice(-lines);
      return recentLines.join('\n');
    } catch (error) {
      return `Failed to read logs: ${error}`;
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await fs.writeFile(this.logFilePath, '', 'utf-8');
      this.info('general', 'Logs cleared');
    } catch (error) {
      this.error('general', 'Failed to clear logs', error as Error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
