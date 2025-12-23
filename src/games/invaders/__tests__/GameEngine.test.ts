/**
 * GameEngine Tests
 * Tests for main game loop and state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../core/GameEngine.js';

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(800, 600);
  });

  it('should initialize with player', () => {
    expect(engine.player).toBeDefined();
    expect(engine.player.alive).toBe(true);
  });

  it('should initialize with invaders', () => {
    expect(engine.invaders.length).toBe(55); // 5 rows × 11 columns
  });

  it('should start with 3 lives', () => {
    expect(engine.lives).toBe(3);
  });

  it('should start with score 0', () => {
    expect(engine.score).toBe(0);
  });

  it('should not be game over initially', () => {
    expect(engine.isGameOver()).toBe(false);
  });

  it('should handle player input', () => {
    const initialX = engine.player.x;

    engine.handleInput('ArrowLeft');

    expect(engine.player.x).toBeLessThan(initialX);
  });

  it('should fire bullet on spacebar', () => {
    const initialBullets = engine.bullets.length;

    engine.handleInput('Space');

    expect(engine.bullets.length).toBe(initialBullets + 1);
  });

  it('should update all entities', () => {
    engine.handleInput('Space');
    const bullet = engine.bullets[0];
    const initialY = bullet.y;

    engine.update(16); // One frame

    expect(bullet.y).toBeLessThan(initialY); // Bullet moved up
  });

  it('should detect bullet-invader collision', () => {
    const invader = engine.invaders[0];
    engine.handleInput('Space');
    const bullet = engine.bullets[0];

    // Position bullet to hit invader
    bullet.x = invader.x;
    bullet.y = invader.y;

    engine.update(16);

    expect(invader.alive).toBe(false);
    expect(bullet.alive).toBe(false);
    expect(engine.score).toBeGreaterThan(0);
  });

  it('should be game over when player dies', () => {
    engine.player.kill();

    engine.update(16);

    expect(engine.isGameOver()).toBe(true);
  });

  it('should be victory when all invaders dead', () => {
    engine.invaders.forEach(inv => inv.kill());
    engine.update(16); // Update to filter dead invaders

    expect(engine.isVictory()).toBe(true);
  });

  it('should move invaders in formation', () => {
    const initialX = engine.invaders[0].x;

    // Move timer needs to reach 1000ms to trigger movement
    engine.update(1100); // Exceed move interval

    expect(engine.invaders[0].x).not.toBe(initialX);
  });

  it('should remove dead entities', () => {
    engine.invaders[0].kill();
    const initialCount = engine.invaders.length;

    engine.update(16);

    expect(engine.invaders.length).toBe(initialCount - 1);
  });
});
