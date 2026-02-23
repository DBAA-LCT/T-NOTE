/**
 * 应用配置集中管理
 */

export const CONFIG = {
  oauth: {
    onedrive: {
      clientId: 'b734699f-3727-49ec-8016-12122c78c0a2',
      redirectUri: 'http://localhost:3000/auth/callback',
      authUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      scope: 'Files.ReadWrite offline_access User.Read',
    },
    baidupan: {
      clientId: 'gs2jbazfqnBglCmZxlO2mG89H8U5t3kG',
      clientSecret: '5nuxevJbX4iK6dflqIchxIYSMRNmkrl4',
      redirectUri: 'http://localhost:3001/baidu/callback',
      authUrl: 'https://openapi.baidu.com/oauth/2.0/authorize',
      tokenUrl: 'https://openapi.baidu.com/oauth/2.0/token',
      scope: 'basic,netdisk',
    },
  },
  api: {
    onedrive: {
      baseUrl: 'https://graph.microsoft.com/v1.0',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    },
    baidupan: {
      baseUrl: 'https://pan.baidu.com/rest/2.0/xpan',
      userInfoUrl: 'https://pan.baidu.com/rest/2.0/xpan/nas',
    },
  },
  sync: {
    defaultFolder: {
      onedrive: '/TNote',
      baidupan: '/apps/TNote',
    },
  },
};
