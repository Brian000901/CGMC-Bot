module.exports = async function (message) {
    if (message.content === '!minesweeper') {
        const generateMinesweeperBoard = (rows, cols, mines) => {
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],         [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            const board = Array.from({ length: rows }, () => Array(cols).fill('||:zero:||'));
            let minesPlaced = 0;

            // Place mines
            while (minesPlaced < mines) {
                const row = Math.floor(Math.random() * rows);
                const col = Math.floor(Math.random() * cols);
                if (board[row][col] === '||:zero:||') {
                    board[row][col] = '||:bomb:||';
                    minesPlaced++;
                }
            }

            // Calculate numbers
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    if (board[row][col] === '||:bomb:||') continue;
                    let mineCount = 0;
                    for (const [dx, dy] of directions) {
                        const newRow = row + dx;
                        const newCol = col + dy;
                        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols && board[newRow][newCol] === '||:bomb:||') {
                            mineCount++;
                        }
                    }
                    board[row][col] = `||:${['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][mineCount]}:||`;
                }
            }

            return board.map(row => row.join(' ')).join('\n'); // Ensure spaces between cells
        };

        const rows = 9; // Changed board rows to 9
        const cols = 11; // Changed board columns to 11
        const mines = 20; // Assuming 20 mines for a 9x11 board to balance difficulty
        const board = generateMinesweeperBoard(rows, cols, mines);
        const messageContent = `這是一個有 ${mines} 顆地雷的 ${rows}x${cols} 遊戲:\n${board}`;
        await message.channel.send(messageContent);
    }
};