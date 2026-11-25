import { defineConfig } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 8799)
const executablePath = process.env.CHROMIUM_PATH

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    httpCredentials: { username: 'ceo', password: 'e2e-password' },
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'node server/index.ts',
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: false,
    env: { APP_PASSWORD: 'e2e-password', PORT: String(port), HOST: '127.0.0.1', APP_VERSION: 'e2e' },
  },
})
