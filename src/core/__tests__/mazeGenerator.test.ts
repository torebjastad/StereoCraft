import { describe, it, expect } from 'vitest';
import { generateMaze, isMazeSolvable } from '../mazeGenerator.ts';

describe('mazeGenerator', () => {
  it('generates a grid of the requested dimensions', () => {
    const cols = 9;
    const rows = 7;
    const maze = generateMaze(cols, rows, 42);

    expect(maze.cols).toBe(cols);
    expect(maze.rows).toBe(rows);
    expect(maze.cells.length).toBe(rows);
    expect(maze.cells[0].length).toBe(cols);
    expect(maze.startX).toBe(0);
    expect(maze.startY).toBe(0);
    expect(maze.goalX).toBe(cols - 1);
    expect(maze.goalY).toBe(rows - 1);
  });

  it('guarantees that every generated maze is solvable from start to goal', () => {
    // Test multiple random seeds
    for (const seed of [101, 202, 303, 404, 505]) {
      const maze = generateMaze(11, 8, seed);
      const solvable = isMazeSolvable(maze);
      expect(solvable).toBe(true);
    }
  });

  it('maintains reciprocal wall passages between adjacent cells', () => {
    const maze = generateMaze(8, 6, 999);
    for (let y = 0; y < maze.rows; y++) {
      for (let x = 0; x < maze.cols; x++) {
        const cell = maze.cells[y][x];
        if (!cell.walls.right && x + 1 < maze.cols) {
          expect(maze.cells[y][x + 1].walls.left).toBe(false);
        }
        if (!cell.walls.bottom && y + 1 < maze.rows) {
          expect(maze.cells[y + 1][x].walls.top).toBe(false);
        }
      }
    }
  });
});
