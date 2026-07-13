class AcchiMuiteAI {
    constructor() {
        this.directions = ['上', '左', '下', '右'];
        this.dirIndex = { '上': 0, '左': 1, '下': 2, '右': 3 };
        this.opponentHistory = [];
        this.myHistory = [];
        this.MAX_HISTORY = 50;
        this.loadedCounts = {
            dirs: { '上': 0, '左': 0, '下': 0, '右': 0 },
            diff: { '0': 0, '1': 0, '2': 0, '3': 0 }
        };
    }

    loadStats(stats) {
        if (stats) {
            this.loadedCounts.dirs = stats.dirs || { '上': 0, '左': 0, '下': 0, '右': 0 };
            this.loadedCounts.diff = stats.diff || { '0': 0, '1': 0, '2': 0, '3': 0 };
        }
    }

    exportStats() {
        return {
            dirs: this.loadedCounts.dirs,
            diff: this.loadedCounts.diff
        };
    }

    observeOpponent(direction) {
        const idx = this.dirIndex[direction];
        this.opponentHistory.push(idx);
        if (this.opponentHistory.length > this.MAX_HISTORY) {
            this.opponentHistory.shift();
        }
        this.loadedCounts.dirs[direction] = (this.loadedCounts.dirs[direction] || 0) + 1;
        if (this.opponentHistory.length >= 2) {
            const prevIdx = this.opponentHistory[this.opponentHistory.length - 2];
            const diff = ((idx - prevIdx) % 4 + 4) % 4;
            this.loadedCounts.diff[String(diff)] = (this.loadedCounts.diff[String(diff)] || 0) + 1;
        }
    }

    predictOpponent() {
        const len = this.opponentHistory.length;
        if (len === 0) {
            const maxCount = Math.max(
                this.loadedCounts.dirs['上'] || 0,
                this.loadedCounts.dirs['左'] || 0,
                this.loadedCounts.dirs['下'] || 0,
                this.loadedCounts.dirs['右'] || 0
            );
            for (const d of this.directions) {
                if ((this.loadedCounts.dirs[d] || 0) === maxCount && maxCount > 0) {
                    return d;
                }
            }
            return this.directions[Math.floor(Math.random() * 4)];
        }

        const scores = {};
        for (const d of this.directions) scores[d] = 0;
        const lastIdx = this.opponentHistory[len - 1];

        const freq = {};
        for (const idx of this.opponentHistory) {
            const d = this.directions[idx];
            freq[d] = (freq[d] || 0) + 1;
        }
        let maxF = 0, best = this.directions[0];
        for (const [d, c] of Object.entries(freq)) {
            if (c > maxF) { maxF = c; best = d; }
        }

        const totalDirs = Object.values(this.loadedCounts.dirs).reduce((a, b) => a + b, 0);
        if (totalDirs > 0) {
            for (const d of this.directions) {
                scores[d] += (this.loadedCounts.dirs[d] || 0) / totalDirs * 0.5;
            }
        }

        scores[best] += 1.0;
        scores[this.directions[lastIdx]] -= 0.3;

        let maxScore = -Infinity;
        let bestDirs = [];
        for (const [dir, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                bestDirs = [dir];
            } else if (score === maxScore) {
                bestDirs.push(dir);
            }
        }

        if (maxScore <= 0) return best;
        return bestDirs[Math.floor(Math.random() * bestDirs.length)];
    }

    getPointDirection() {
        return this.predictOpponent();
    }

    getMoveDirection() {
        const len = this.opponentHistory.length;
        if (len === 0) {
            return this.directions[Math.floor(Math.random() * 4)];
        }
        // 簡易的にランダム（後で強化）
        return this.directions[Math.floor(Math.random() * 4)];
    }

    play(role, playerDirection) {
        this.observeOpponent(playerDirection);
        let aiDirection;
        if (role === 'pointer') {
            aiDirection = this.getPointDirection();
        } else {
            aiDirection = this.getMoveDirection();
        }
        this.myHistory.push(this.dirIndex[aiDirection]);
        if (this.myHistory.length > this.MAX_HISTORY) {
            this.myHistory.shift();
        }
        return aiDirection;
    }

    reset() {
        this.opponentHistory = [];
        this.myHistory = [];
        this.loadedCounts.dirs = { '上': 0, '左': 0, '下': 0, '右': 0 };
        this.loadedCounts.diff = { '0': 0, '1': 0, '2': 0, '3': 0 };
    }
}