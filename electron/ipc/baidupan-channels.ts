/**
 * 百度网盘 IPC 通道定义
 */

export const BAIDU_IPC_CHANNELS = {
  // 认证
  AUTH_AUTHENTICATE: 'baidupan:auth:authenticate',
  AUTH_DISCONNECT: 'baidupan:auth:disconnect',
  AUTH_GET_USER_INFO: 'baidupan:auth:getUserInfo',
  AUTH_IS_AUTHENTICATED: 'baidupan:auth:isAuthenticated',

  // 文件操作
  FILE_LIST: 'baidupan:file:list',
  FILE_UPLOAD: 'baidupan:file:upload',
  FILE_DOWNLOAD: 'baidupan:file:download',
  FILE_DELETE: 'baidupan:file:delete',
  FILE_CREATE_FOLDER: 'baidupan:file:createFolder',

  // 网盘信息
  QUOTA_GET: 'baidupan:quota:get',

  // 同步
  SYNC_UPLOAD_NOTE: 'baidupan:sync:uploadNote',
  SYNC_GET_CLOUD_NOTES: 'baidupan:sync:getCloudNotes',
  SYNC_DOWNLOAD_NOTE: 'baidupan:sync:downloadNote',

  // 文件夹浏览
  FOLDER_BROWSE: 'baidupan:folder:browse',
  FOLDER_SET_SYNC: 'baidupan:folder:setSyncFolder',
  FOLDER_GET_SYNC: 'baidupan:folder:getSyncFolder',

  // 设置
  SETTINGS_GET: 'baidupan:settings:get',
  SETTINGS_UPDATE: 'baidupan:settings:update',

  // 事件 (Main -> Renderer)
  EVENT_SYNC_PROGRESS: 'baidupan:event:syncProgress',
  EVENT_SYNC_COMPLETE: 'baidupan:event:syncComplete',
  EVENT_SYNC_ERROR: 'baidupan:event:syncError',
};
