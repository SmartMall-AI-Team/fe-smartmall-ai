import { defineConfig, devices } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL || 'http://127.0.0.1:8000/api/v1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host localhost --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_BASE_URL: apiUrl, VITE_DEMO_ACCESS_REQUIRED: process.env.E2E_ACCESS_TOKEN ? 'true' : 'false' },
  },
});
