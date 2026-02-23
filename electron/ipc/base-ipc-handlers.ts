/**
 * 通用 IPC 处理器工厂函数
 * 
 * 减少重复的 IPC 处理器代码
 */

import { ipcMain } from 'electron';
import { logger, LogCategory } from '../utils/logger';

export interface AuthHandlers<TUserInfo> {
  authenticate: () => Promise<TUserInfo>;
  disconnect: () => Promise<void>;
  getUserInfo: () => Promise<TUserInfo>;
  isAuthenticated: () => boolean;
}

export interface IpcChannels {
  AUTH_AUTHENTICATE: string;
  AUTH_DISCONNECT: string;
  AUTH_GET_USER_INFO: string;
  AUTH_IS_AUTHENTICATED: string;
}

/**
 * 注册通用的认证 IPC 处理器
 */
export function registerAuthHandlers<TUserInfo>(
  channels: IpcChannels,
  handlers: AuthHandlers<TUserInfo>,
  providerName: string
): void {
  ipcMain.handle(channels.AUTH_AUTHENTICATE, async () => {
    try {
      logger.info('auth', `${providerName}: IPC 开始认证`);
      const userInfo = await handlers.authenticate();
      logger.info('auth', `${providerName}: IPC 认证成功`);
      return userInfo;
    } catch (error) {
      logger.error('auth', `${providerName}: IPC 认证失败`, error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.AUTH_DISCONNECT, async () => {
    try {
      logger.info('auth', `${providerName}: IPC 断开连接`);
      await handlers.disconnect();
      logger.info('auth', `${providerName}: IPC 断开成功`);
    } catch (error) {
      logger.error('auth', `${providerName}: IPC 断开失败`, error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.AUTH_GET_USER_INFO, async () => {
    try {
      return await handlers.getUserInfo();
    } catch (error) {
      logger.error('auth', `${providerName}: IPC 获取用户信息失败`, error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.AUTH_IS_AUTHENTICATED, async () => {
    try {
      return handlers.isAuthenticated();
    } catch (error) {
      logger.error('auth', `${providerName}: IPC 检查认证失败`, error as Error);
      return false;
    }
  });
}

/**
 * 创建带错误处理和日志的 IPC 处理器包装器
 */
export function createIpcHandler<TArgs extends any[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
  category: LogCategory,
  operationName: string
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      logger.info(category, `IPC: ${operationName} 开始`);
      const result = await handler(...args);
      logger.info(category, `IPC: ${operationName} 成功`);
      return result;
    } catch (error) {
      logger.error(category, `IPC: ${operationName} 失败`, error as Error);
      throw error;
    }
  };
}
