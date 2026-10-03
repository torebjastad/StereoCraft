export interface MazeCell {
  x: number;
  y: number;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

export interface MazeGrid {
  cols: number;
  rows: number;
  cells: MazeCell[][];
  startX: number;
  startY: number;
  goalX: number;
  goalY: number;
}

/**
 * Procedural maze generation using Recursive Backtracking algorithm
 * Guaranteed to produce a perfect maze (fully connected, no loops, solvable)
 */
export function generateMaze(cols: number, rows: number, rngSeed?: number): MazeGrid {
  // Initialize cell grid with all walls intact
  const cells: MazeCell[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: MazeCell[] = [];
    for (let x = 0; x < cols; x++) {
      row.push({
        x,
        y,
        walls: { top: true, right: true, bottom: true, left: true },
      });
    }
    cells.push(row);
  }

  // PRNG if seed provided
  let seed = rngSeed ?? Math.floor(Math.random() * 1000000);
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack: [number, number][] = [];

  // Start at (0, 0)
  visited[0][0] = true;
  stack.push([0, 0]);

  const directions = [
    { dx: 0, dy: -1, wall: 'top' as const, opp: 'bottom' as const },
    { dx: 1, dy: 0, wall: 'right' as const, opp: 'left' as const },
    { dx: 0, dy: 1, wall: 'bottom' as const, opp: 'top' as const },
    { dx: -1, dy: 0, wall: 'left' as const, opp: 'right' as const },
  ];

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];

    // Find unvisited neighbors
    const neighbors: { nx: number; ny: number; wall: 'top' | 'right' | 'bottom' | 'left'; opp: 'top' | 'right' | 'bottom' | 'left' }[] = [];

    for (const dir of directions) {
      const nx = cx + dir.dx;
      const ny = cy + dir.dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
        neighbors.push({ nx, ny, wall: dir.wall, opp: dir.opp });
      }
    }

    if (neighbors.length > 0) {
      // Pick random neighbor
      const pickIdx = Math.floor(random() * neighbors.length);
      const chosen = neighbors[pickIdx];

      // Remove walls between current and chosen
      cells[cy][cx].walls[chosen.wall] = false;
      cells[chosen.ny][chosen.nx].walls[chosen.opp] = false;

      visited[chosen.ny][chosen.nx] = true;
      stack.push([chosen.nx, chosen.ny]);
    } else {
      stack.pop();
    }
  }

  return {
    cols,
    rows,
    cells,
    startX: 0,
    startY: 0,
    goalX: cols - 1,
    goalY: rows - 1,
  };
}

/**
 * Checks if a path exists between start and goal using BFS
 */
export function isMazeSolvable(maze: MazeGrid): boolean {
  const { cols, rows, cells, startX, startY, goalX, goalY } = maze;
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue: [number, number][] = [[startX, startY]];
  visited[startY][startX] = true;

  const dirs = [
    { dx: 0, dy: -1, wall: 'top' as const },
    { dx: 1, dy: 0, wall: 'right' as const },
    { dx: 0, dy: 1, wall: 'bottom' as const },
    { dx: -1, dy: 0, wall: 'left' as const },
  ];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    if (cx === goalX && cy === goalY) {
      return true;
    }

    const currentCell = cells[cy][cx];
    for (const dir of dirs) {
      if (!currentCell.walls[dir.wall]) {
        const nx = cx + dir.dx;
        const ny = cy + dir.dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
          visited[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
    }
  }

  return false;
}
