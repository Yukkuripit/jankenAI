// ============================================================
//  ファイル: acchimuite-ai.js
//  役割: あっちむいてホイAI (配置思考ゼロ版)
//  特徴: 方向の差分パターン(配置順序)を完全無効化
// ============================================================

class AcchiMuiteAI {
    constructor() {
        this.MAX_HISTORY = 150;
        this.directions = ['上', '左', '下', '右'];
        this.dirIndex = { '上': 0, '左': 1, '下': 2, '右': 3 };
        this.opponentHistory = [];
        this.myHistory = [];
        this.missRate = 0.15;
    }

    observeOpponent(direction) {
        const idx = this.dirIndex[direction];
        this.opponentHistory.push(idx);
        if (this.opponentHistory.length > this.MAX_HISTORY) {
            this.opponentHistory.shift();
        }
    }

    predictOpponent() {
        const len = this.opponentHistory.length;
        if (len === 0) {
            return this.directions[Math.floor(Math.random() * 4)];
        }

        const lastIdx = this.opponentHistory[len - 1];
        const scores = {};
        for (const d of this.directions) scores[d] = 0;

        // ---- 差分パターン（配置順序）を完全無効化！ ----
        // 従来の差分カウント処理をすべてコメントアウト

        // ---- 1. 絶対遷移（直前の方向→次の方向） ----
        const transitionCounts = {};
        for (let i = 1; i < len; i++) {
            const key = this.directions[this.opponentHistory[i - 1]] + ',' + this.directions[this.opponentHistory[i]];
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
        const lastDir = this.directions[lastIdx];
        for (const [key, count] of Object.entries(transitionCounts)) {
            const [prev, next] = key.split(',');
            if (prev === lastDir) {
                scores[next] += count * 1.5;
            }
        }

        // ---- 2. 直近傾向 ----
        const recent = this.opponentHistory.slice(-5);
        if (recent.length > 0) {
            const freq = {};
            for (const idx of recent) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / recent.length * 1.2;
            }
        }

        // ---- 3. 全局傾向 ----
        if (len > 0) {
            const freq = {};
            for (const idx of this.opponentHistory) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / len * 1.0;
            }
        }

        // ---- 4. 連続ペナルティ ----
        scores[this.directions[lastIdx]] -= 0.3;

        // 最高スコア選択
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
        const predicted = this.predictOpponent();
        if (Math.random() < this.missRate) {
            const others = this.directions.filter(d => d !== predicted);
            return others[Math.floor(Math.random() * others.length)];
        }
        return predicted;
    }

    getMoveDirection() {
        const len = this.opponentHistory.length;
        if (len === 0) {
            return this.directions[Math.floor(Math.random() * 4)];
        }

        const lastIdx = this.opponentHistory[len - 1];
        const scores = {};
        for (const d of this.directions) scores[d] = 0;

        // ---- 差分パターンを完全無効化 ----

        // 絶対遷移
        const transitionCounts = {};
        for (let i = 1; i < len; i++) {
            const key = this.directions[this.opponentHistory[i - 1]] + ',' + this.directions[this.opponentHistory[i]];
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
        const lastDir = this.directions[lastIdx];
        for (const [key, count] of Object.entries(transitionCounts)) {
            const [prev, next] = key.split(',');
            if (prev === lastDir) {
                scores[next] += count * 1.5;
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
                scores[d] += (freq[d] || 0) / recent.length * 1.2;
            }
        }

        // 全局傾向
        if (len > 0) {
            const freq = {};
            for (const idx of this.opponentHistory) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / len * 1.0;
            }
        }

        // 動かす側も外し率適用
        if (Math.random() < this.missRate) {
            return this.directions[Math.floor(Math.random() * 4)];
        }

        // スコアが低い方向を選ぶ（避ける）
        const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
        const candidates = sorted.slice(0, Math.min(3, sorted.length));
        const threshold = candidates[candidates.length - 1][1];
        const pool = sorted.filter(([_, s]) => s <= threshold + 0.1);
        const picked = pool[Math.floor(Math.random() * pool.length)];
        return picked ? picked[0] : this.directions[Math.floor(Math.random() * 4)];
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
    }
}