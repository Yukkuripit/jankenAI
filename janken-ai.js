class JankenAI {
    constructor() {
        this.moves = ['グー', 'チョキ', 'パー'];
        this.moveIndex = { 'グー': 0, 'チョキ': 1, 'パー': 2 };
        this.winMap = { 'グー': 'パー', 'チョキ': 'グー', 'パー': 'チョキ' };
        this.history = [];
        this.MAX_HISTORY = 50;
        this.loadedCounts = {
            moves: { 'グー': 0, 'チョキ': 0, 'パー': 0 },
            diff: { '0': 0, '1': 0, '2': 0 }
        };
        this.firstMoveBias = 'グー';
    }

    loadStats(stats) {
        if (stats) {
            this.loadedCounts.moves = stats.moves || { 'グー': 0, 'チョキ': 0, 'パー': 0 };
            this.loadedCounts.diff = stats.diff || { '0': 0, '1': 0, '2': 0 };
        }
    }

    exportStats() {
        return {
            moves: this.loadedCounts.moves,
            diff: this.loadedCounts.diff
        };
    }

    observe(playerMove) {
        const idx = this.moveIndex[playerMove];
        this.history.push(idx);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
        this.loadedCounts.moves[playerMove] = (this.loadedCounts.moves[playerMove] || 0) + 1;
        if (this.history.length >= 2) {
            const prevIdx = this.history[this.history.length - 2];
            const diff = ((idx - prevIdx) % 3 + 3) % 3;
            this.loadedCounts.diff[String(diff)] = (this.loadedCounts.diff[String(diff)] || 0) + 1;
        }
    }

    predict() {
        const len = this.history.length;
        if (len === 0) {
            const maxCount = Math.max(
                this.loadedCounts.moves['グー'] || 0,
                this.loadedCounts.moves['チョキ'] || 0,
                this.loadedCounts.moves['パー'] || 0
            );
            for (const move of this.moves) {
                if ((this.loadedCounts.moves[move] || 0) === maxCount && maxCount > 0) {
                    return move;
                }
            }
            return this.firstMoveBias;
        }

        const scores = { 'グー': 0, 'チョキ': 0, 'パー': 0 };
        const lastIdx = this.history[len - 1];

        // 履歴から最多手を予測（簡単な実装）
        const freq = {};
        for (const idx of this.history) {
            const m = this.moves[idx];
            freq[m] = (freq[m] || 0) + 1;
        }
        let maxF = 0, best = this.moves[0];
        for (const [m, c] of Object.entries(freq)) {
            if (c > maxF) { maxF = c; best = m; }
        }

        // D1統計も考慮
        const totalMoves = Object.values(this.loadedCounts.moves).reduce((a, b) => a + b, 0);
        if (totalMoves > 0) {
            for (const move of this.moves) {
                scores[move] += (this.loadedCounts.moves[move] || 0) / totalMoves * 0.5;
            }
        }

        scores[best] += 1.0;

        // 連続ペナルティ
        scores[this.moves[lastIdx]] -= 0.3;

        let maxScore = -Infinity;
        let bestMoves = [];
        for (const [move, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                bestMoves = [move];
            } else if (score === maxScore) {
                bestMoves.push(move);
            }
        }

        if (maxScore <= 0) {
            return best;
        }

        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    getAIMove() {
        const predicted = this.predict();
        return this.winMap[predicted];
    }

    play(playerMove) {
        const aiMove = this.getAIMove();
        const result = this._judge(playerMove, aiMove);
        this.observe(playerMove);
        return { aiMove, result };
    }

    _judge(player, ai) {
        if (player === ai) return 'draw';
        if ((ai === 'パー' && player === 'グー') ||
            (ai === 'グー' && player === 'チョキ') ||
            (ai === 'チョキ' && player === 'パー')) {
            return 'ai_win';
        }
        return 'player_win';
    }

    reset() {
        this.history = [];
        this.loadedCounts.moves = { 'グー': 0, 'チョキ': 0, 'パー': 0 };
        this.loadedCounts.diff = { '0': 0, '1': 0, '2': 0 };
    }
}