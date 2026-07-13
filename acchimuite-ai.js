// ============================================================
//  ファイル: acchimuite-ai.js
//  役割: あっちむいてホイAI (メタ戦略版)
//  - スコアが均等ならランダムと判断 → 前回と違う方向を選ぶ
// ============================================================

class AcchiMuiteAI {
    constructor() {
        this.MAX_HISTORY = 50;

        this.directions = ['上', '左', '下', '右'];
        this.dirIndex = { '上': 0, '左': 1, '下': 2, '右': 3 };

        this.opponentHistory = [];
        this.myHistory = [];
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

        // ---- 差分カウント再計算 ----
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
                scores[this.directions[nextIdx]] += 2.0;
            }
            for (const [diff, count] of Object.entries(diffCounts)) {
                const d = parseInt(diff);
                const nextIdx = (lastIdx + d) % 4;
                const weight = count / len;
                scores[this.directions[nextIdx]] += weight * 1.5;
            }
        }

        // ---- 絶対遷移 ----
        const transitionCounts = {};
        for (let i = 1; i < len; i++) {
            const key = this.directions[this.opponentHistory[i - 1]] + ',' + this.directions[this.opponentHistory[i]];
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
        const lastDir = this.directions[lastIdx];
        for (const [key, count] of Object.entries(transitionCounts)) {
            const [prev, next] = key.split(',');
            if (prev === lastDir) {
                scores[next] += count * 0.8;
            }
        }

        // ---- 直近傾向 ----
        const recent = this.opponentHistory.slice(-5);
        if (recent.length > 0) {
            const freq = {};
            for (const idx of recent) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / recent.length * 1.0;
            }
        }

        // ---- 全局傾向 ----
        if (len > 0) {
            const freq = {};
            for (const idx of this.opponentHistory) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / len * 0.5;
            }
        }

        // ---- 連続ペナルティ ----
        scores[this.directions[lastIdx]] -= 0.3;

        // ---- 🆕 ランダム判定 ----
        const scoreValues = Object.values(scores);
        const maxScore = Math.max(...scoreValues);
        const minScore = Math.min(...scoreValues);
        const isRandom = (maxScore - minScore) < 0.5;

        if (isRandom) {
            // ランダムと判断したら、前回の方向を避ける
            const candidates = this.directions.filter(d => d !== this.directions[lastIdx]);
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        // ---- 通常選択 ----
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
        const len = this.opponentHistory.length;
        if (len === 0) {
            return this.directions[Math.floor(Math.random() * 4)];
        }

        const lastIdx = this.opponentHistory[len - 1];
        const scores = {};
        for (const d of this.directions) scores[d] = 0;

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
                scores[this.directions[nextIdx]] += 2.0;
            }
            for (const [diff, count] of Object.entries(diffCounts)) {
                const d = parseInt(diff);
                const nextIdx = (lastIdx + d) % 4;
                scores[this.directions[nextIdx]] += (count / len) * 1.5;
            }
        }

        const transitionCounts = {};
        for (let i = 1; i < len; i++) {
            const key = this.directions[this.opponentHistory[i - 1]] + ',' + this.directions[this.opponentHistory[i]];
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
        const lastDir = this.directions[lastIdx];
        for (const [key, count] of Object.entries(transitionCounts)) {
            const [prev, next] = key.split(',');
            if (prev === lastDir) {
                scores[next] += count * 0.8;
            }
        }

        const recent = this.opponentHistory.slice(-5);
        if (recent.length > 0) {
            const freq = {};
            for (const idx of recent) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / recent.length * 1.0;
            }
        }

        if (len > 0) {
            const freq = {};
            for (const idx of this.opponentHistory) {
                const d = this.directions[idx];
                freq[d] = (freq[d] || 0) + 1;
            }
            for (const d of this.directions) {
                scores[d] += (freq[d] || 0) / len * 0.5;
            }
        }

        // ---- 🆕 ランダム判定（動かす側も同じロジック） ----
        const scoreValues = Object.values(scores);
        const maxScore = Math.max(...scoreValues);
        const minScore = Math.min(...scoreValues);
        const isRandom = (maxScore - minScore) < 0.5;

        if (isRandom) {
            // ランダムと判断したら、前回の方向を避ける
            const candidates = this.directions.filter(d => d !== this.directions[lastIdx]);
            return candidates[Math.floor(Math.random() * candidates.length)];
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