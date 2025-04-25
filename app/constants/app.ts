type App = {
  name: string,
  description: string,
  scope: string,
  base: string,
  registerType: string,
  manifest: {
    id: string,
    scope: string,
    name: string,
    short_name: string,
    description: string,
  }
}
export const app: App = {
  name: 'appName',
  description: 'appDescription',
  scope: '/',
  base: '/',
  registerType: 'autoUpdate',
  manifest: {
    id: '/',
    scope: '/',
    name: 'appName',
    short_name: 'appName',
    description: 'appDescription',
  }
}