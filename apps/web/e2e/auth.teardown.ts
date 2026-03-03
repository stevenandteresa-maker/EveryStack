import { test as teardown } from '@playwright/test';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTH_STATE_PATH = resolve(__dirname, '.auth/user.json');

teardown('cleanup auth state', async () => {
  if (existsSync(AUTH_STATE_PATH)) {
    unlinkSync(AUTH_STATE_PATH);
  }
});
