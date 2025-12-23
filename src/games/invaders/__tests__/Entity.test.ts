/**
 * Entity Base Class Tests
 * Tests for the base game entity
 */

import { describe, it, expect } from 'vitest';
import { Entity } from '../core/Entity.js';

describe('Entity', () => {
  it('should create entity with position', () => {
    const entity = new Entity(100, 200);

    expect(entity.x).toBe(100);
    expect(entity.y).toBe(200);
  });

  it('should have width and height', () => {
    const entity = new Entity(0, 0, 50, 30);

    expect(entity.width).toBe(50);
    expect(entity.height).toBe(30);
  });

  it('should have alive state', () => {
    const entity = new Entity(0, 0);

    expect(entity.alive).toBe(true);
  });

  it('should be able to die', () => {
    const entity = new Entity(0, 0);

    entity.kill();

    expect(entity.alive).toBe(false);
  });

  it('should update position', () => {
    const entity = new Entity(10, 20);

    entity.move(5, 10);

    expect(entity.x).toBe(15);
    expect(entity.y).toBe(30);
  });

  it('should have bounding box', () => {
    const entity = new Entity(10, 20, 50, 30);

    const box = entity.getBounds();

    expect(box.left).toBe(10);
    expect(box.right).toBe(60);
    expect(box.top).toBe(20);
    expect(box.bottom).toBe(50);
  });
});
