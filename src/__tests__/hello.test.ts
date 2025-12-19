import request from 'supertest';
import { app } from '../index.js';
import { describe, it, expect } from 'vitest';

describe('GET /api/hello', () => {
  it('should return 200 status', async () => {
    const response = await request(app).get('/api/hello');
    expect(response.status).toBe(200);
  });

  it('should return JSON content type', async () => {
    const response = await request(app).get('/api/hello');
    expect(response.type).toBe('application/json');
  });

  it('should return hello world message', async () => {
    const response = await request(app).get('/api/hello');
    expect(response.body).toEqual({
      message: 'Hello, World!',
      timestamp: expect.any(String)
    });
  });

  it('should return valid ISO timestamp', async () => {
    const response = await request(app).get('/api/hello');
    const timestamp = new Date(response.body.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.getTime()).not.toBeNaN();
  });
});
