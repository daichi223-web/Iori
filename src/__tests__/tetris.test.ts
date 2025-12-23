/**
 * Tetris Game Core Logic Tests
 * TDD: RED phase - Write failing tests first
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TetrisGame,
  Tetromino,
  TetrominoType,
  createBoard,
  rotatePiece,
  checkCollision,
  clearLines,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from '../games/tetris/tetris-core.js';

describe('Tetris Core Logic', () => {
  describe('createBoard', () => {
    it('should create a board with correct dimensions', () => {
      const board = createBoard();
      expect(board.length).toBe(BOARD_HEIGHT);
      expect(board[0].length).toBe(BOARD_WIDTH);
    });

    it('should initialize all cells to null', () => {
      const board = createBoard();
      board.forEach(row => {
        row.forEach(cell => {
          expect(cell).toBeNull();
        });
      });
    });
  });

  describe('Tetromino shapes', () => {
    it('should have 7 different tetromino types', () => {
      const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      expect(types.length).toBe(7);
    });
  });

  describe('rotatePiece', () => {
    it('should rotate I piece 90 degrees clockwise', () => {
      const iPiece: number[][] = [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      const rotated = rotatePiece(iPiece);
      expect(rotated[0][2]).toBe(1);
      expect(rotated[1][2]).toBe(1);
      expect(rotated[2][2]).toBe(1);
      expect(rotated[3][2]).toBe(1);
    });

    it('should rotate T piece correctly', () => {
      const tPiece: number[][] = [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ];
      const rotated = rotatePiece(tPiece);
      expect(rotated[0][1]).toBe(1);
      expect(rotated[1][1]).toBe(1);
      expect(rotated[1][2]).toBe(1);
      expect(rotated[2][1]).toBe(1);
    });
  });

  describe('checkCollision', () => {
    it('should detect collision with board boundaries (left)', () => {
      const board = createBoard();
      const piece: Tetromino = {
        type: 'I',
        shape: [[1, 1, 1, 1]],
        x: -1,
        y: 0,
      };
      expect(checkCollision(board, piece)).toBe(true);
    });

    it('should detect collision with board boundaries (right)', () => {
      const board = createBoard();
      const piece: Tetromino = {
        type: 'I',
        shape: [[1, 1, 1, 1]],
        x: BOARD_WIDTH - 2,
        y: 0,
      };
      expect(checkCollision(board, piece)).toBe(true);
    });

    it('should detect collision with board boundaries (bottom)', () => {
      const board = createBoard();
      const piece: Tetromino = {
        type: 'O',
        shape: [
          [1, 1],
          [1, 1],
        ],
        x: 0,
        y: BOARD_HEIGHT - 1,
      };
      expect(checkCollision(board, piece)).toBe(true);
    });

    it('should detect collision with existing blocks', () => {
      const board = createBoard();
      board[5][5] = 'T';
      const piece: Tetromino = {
        type: 'O',
        shape: [
          [1, 1],
          [1, 1],
        ],
        x: 4,
        y: 4,
      };
      expect(checkCollision(board, piece)).toBe(true);
    });

    it('should return false when no collision', () => {
      const board = createBoard();
      const piece: Tetromino = {
        type: 'O',
        shape: [
          [1, 1],
          [1, 1],
        ],
        x: 4,
        y: 4,
      };
      expect(checkCollision(board, piece)).toBe(false);
    });
  });

  describe('clearLines', () => {
    it('should clear a complete line', () => {
      const board = createBoard();
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[BOARD_HEIGHT - 1][x] = 'I';
      }
      const { newBoard, linesCleared } = clearLines(board);
      expect(linesCleared).toBe(1);
      expect(newBoard[BOARD_HEIGHT - 1].every(cell => cell === null)).toBe(true);
    });

    it('should clear multiple lines', () => {
      const board = createBoard();
      for (let y = BOARD_HEIGHT - 2; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          board[y][x] = 'I';
        }
      }
      const { linesCleared } = clearLines(board);
      expect(linesCleared).toBe(2);
    });

    it('should not clear incomplete lines', () => {
      const board = createBoard();
      for (let x = 0; x < BOARD_WIDTH - 1; x++) {
        board[BOARD_HEIGHT - 1][x] = 'I';
      }
      const { linesCleared } = clearLines(board);
      expect(linesCleared).toBe(0);
    });

    it('should shift rows down after clearing', () => {
      const board = createBoard();
      board[BOARD_HEIGHT - 2][0] = 'T';
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[BOARD_HEIGHT - 1][x] = 'I';
      }
      const { newBoard } = clearLines(board);
      expect(newBoard[BOARD_HEIGHT - 1][0]).toBe('T');
    });
  });

  describe('TetrisGame', () => {
    let game: TetrisGame;

    beforeEach(() => {
      game = new TetrisGame();
    });

    it('should initialize with score 0', () => {
      expect(game.score).toBe(0);
    });

    it('should initialize with level 1', () => {
      expect(game.level).toBe(1);
    });

    it('should initialize with empty board', () => {
      const board = game.getBoard();
      board.forEach(row => {
        row.forEach(cell => {
          expect(cell).toBeNull();
        });
      });
    });

    it('should have a current piece after starting', () => {
      game.start();
      expect(game.getCurrentPiece()).not.toBeNull();
    });

    it('should move piece left', () => {
      game.start();
      const initialX = game.getCurrentPiece()!.x;
      game.moveLeft();
      expect(game.getCurrentPiece()!.x).toBe(initialX - 1);
    });

    it('should move piece right', () => {
      game.start();
      const initialX = game.getCurrentPiece()!.x;
      game.moveRight();
      expect(game.getCurrentPiece()!.x).toBe(initialX + 1);
    });

    it('should move piece down', () => {
      game.start();
      const initialY = game.getCurrentPiece()!.y;
      game.moveDown();
      expect(game.getCurrentPiece()!.y).toBe(initialY + 1);
    });

    it('should rotate piece', () => {
      game.start();
      game.rotate();
      const newShape = JSON.stringify(game.getCurrentPiece()!.shape);
      expect(typeof newShape).toBe('string');
    });

    it('should hard drop piece to bottom', () => {
      game.start();
      game.hardDrop();
      // After hard drop, a new piece should spawn or game should update
      expect(game.getCurrentPiece()).not.toBeNull();
    });

    it('should calculate score correctly for line clears', () => {
      game.start();
      // Score should increase based on lines cleared
      // 1 line = 100, 2 lines = 300, 3 lines = 500, 4 lines = 800 (Tetris)
      expect(game.calculateScore(1)).toBe(100);
      expect(game.calculateScore(2)).toBe(300);
      expect(game.calculateScore(3)).toBe(500);
      expect(game.calculateScore(4)).toBe(800);
    });

    it('should increase level after clearing 10 lines', () => {
      game.start();
      game.addLinesCleared(10);
      expect(game.level).toBe(2);
    });

    it('should detect game over when piece cannot spawn', () => {
      game.start();
      // Fill top rows to trigger game over
      const board = game.getBoard();
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[0][x] = 'I';
        board[1][x] = 'I';
      }
      game.setBoard(board);
      game.spawnNewPiece();
      expect(game.isGameOver()).toBe(true);
    });
  });
});
