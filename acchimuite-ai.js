// ============================================================
//  ファイル: acchimuite-ai.js
//  役割: あっちむいてホイAI（D1統計データを学習に使える版）
// ============================================================

class AcchiMuiteAI {
    constructor() {
        this.MAX_HISTORY = 50;
        this.directions = ['上', '左', '下', '右'];
        this.dirIndex = { '上': 0, '左': 1, '下': 2, '右': 3 };

        this.opponentHistory = [];
        this.myHistory = [];

        // ---- D1統計データ ----
        this.loadedCounts = {
            dirs: { '上': 0, '左': 0, '下': 0, '右': 0 },
            diff: { '0': 0, '1': 0, '2': 0, '3': 0 }
        };
    }

    loadStats(stats) {
        if (stats) {
            this.loadedCounts.dirs = stats.dirs || { '上': 0, '左': 0, '下': 0, '右': 0 };
            this.loadedCounts.diff = stats.diff || { '0': 0, '1': 0, '2': 0, '3': 0 };
        } else {
            this.loadedCounts.dirs = { '上': 0, '左': 0, '下': 0, '右': 0 };
            this.loadedCounts.diff = { '0': 0, '1': 0, '2': 0, '3': 0 };
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

        const lastIdx = this.opponentHistory[len - 1];
        const scores = {};
        for (const d of this.directions) scores[d] = 0;

        // D1統計からの差分
        const totalDiff = Object.values(this.loadedCounts.diff).reduce((a, b) => a + b, 0);
        if (totalDiff > 0) {
            for (const [diff, count] of Object.entries(this.loadedCounts.diff)) {
                const d = parseInt(diff);
                const nextIdx = (lastIdx + d) % 4;
                const weight = count / totalDiff;
                scores[this.directions[nextIdx]] += weight * 2.0;
            }
        }

        // 履歴からの差分
        const diffCounts = {};
        for (let i = 1; i < len; i++) {
            const diff = ((this.opponentHistory[i] - this.opponentHistory[i - 1]) % 4 + 4) % 4;
            diffCounts[diff] = (diffCounts[diff] || 0) + 1;
        }
        if (len >= 2) {
            const prevIdx = this.opponentHistory[len - 2];
            const lastDiff = ((lastIdx - prevIdx) % 4 + 4) % 4;
            if (diffCounts[lastDiff] && diffCounts[lastDiff] > 1) {
                const nextIdx = (lastIdx + lastDiff) % 4;
                scores[this.directions[nextIdx]] += 1.5;
            }
            for (const [diff, count] of Object.entries(diffCounts)) {
                const d = parseInt(diff);
                const nextIdx = (lastIdx + d) % 4;
                const weight = count / len;
                scores[this.directions[nextIdx]] += weight * 1.0;
            }
        }

        // D1全局傾向
        const totalDirs = Object.values(this.loadedCounts.dirs).reduce((a, b) => a + b, 0);
        if (totalDirs > 0) {
            for (const d of this.directions) {
                scores[d] += (this.loadedCounts.dirs[d] || 0) / totalDirs * 0.5;
            }
        }

        // 直近傾向
        const recent = this.opponentHistory.slice(-5);
        if (recent.length > 0) {
            const freq = {};
            for (const idx of recent) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / recent.length * 0.8;
            }
        }

        scores[this.directions[lastIdx]] -= 0.3;

        const scoreValues = Object.values(scores);
        const maxScore = Math.max(...scoreValues);
        const minScore = Math.min(...scoreValues);
        const isRandom = (maxScore - minScore) < 0.5;

        if (isRandom) {
            const candidates = this.directions.filter(d => d !== this.directions[lastIdx]);
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        let bestScore = -Infinity;
        let bestDirs = [];
        for (const [dir, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestDirs = [dir];
            } else if (score === bestScore) {
                bestDirs.push(dir);
            }
        }

        if (bestScore <= 0) {
            const freq = {};
            for (const idx of this.opponentHistory) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            let maxF = 0, best = this.directions[0];
            for (const [d, c] of Object.entries(freq)) {
                if (c > maxF) { maxF = c; best = d; }
            }
            return best;
        }

        return bestDirs[Math.floor(Math.random() * bestDirs.length)];
    }

    getPointDirection() {
        return this.predictOpponent();
    }

    getMoveDirection() {
        // 簡易的にpredictOpponentと同じスコアを計算し、低い方を選ぶ
        // ここでは省略（必要に応じて実装）
        // ただし、D1統計を考慮したバージョンに拡張可能
        const len = this.opponentHistory.length;
        if (len === 0) {
            return this.directions[Math.floor(Math.random() * 4)];
        }
        // 本来は上記と同様のスコアリングで低い方を選ぶ
        // 簡易的にランダムを返す（後で拡張）
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
        // D1統計はリセットしない
    }
}