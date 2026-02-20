import { mock } from 'node:test';

export const cookieStore = {
  set: mock.fn(),
  get: mock.fn(),
  getAll: mock.fn(),
  has: mock.fn(),
  delete: mock.fn(),
};

export const cookies = mock.fn(async () => cookieStore);
