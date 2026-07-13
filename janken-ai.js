// ============================================================
//  ファイル: janken-ai.js
//  役割: じゃんけん特化AI (メタ戦略版)
//  - スコアが均等ならランダムと判断 → 前回と違う手を選ぶ
// ============================================================

class JankenAI {
    constructor() {
        this.MAX_HISTORY = 50;

        this.moves = ['グー', 'チョキ', 'パー'];
        this.moveIndex = { 'グー': 0, 'チョキ': 1, 'パー': 2 };
        this.history = [];

        this.winMap = {
            'グー': 'パー',
            'チョキ': 'グー',
            'パー': 'チョキ'
        };
        this.firstMoveBias = 'グー';
    }

    observe(playerMove) {
        const currentIdx = this.moveIndex[playerMove];
        this.history.push(currentIdx);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }

    predict() {
        const len = this.history.length;
        if (len === 0) return this.firstMoveBias;

        const lastIdx = this.history[len - 1];
        const scores = { 'グー': 0, 'チョキ': 0, 'パー': 0 };

        // ---- 差分カウント再計算 ----
        const diffCounts = {};
        for (let i = 1; i < len; i++) {
            const diff = ((this.history[i] - this.history[i - 1]) % 3 + 3) % 3;
            diffCounts[diff] = (diffCounts[diff] || 0) + 1;
        }

        if (len >= 2) {
            const prevIdx = this.history[len - 2];
            const lastDiff = ((lastIdx - prevIdx) % 3 + 3) % 3;
            if (diffCounts[lastDiff] && diffCounts[lastDiff] > 1) {
                const nextIdx = (lastIdx + lastDiff) % 3;
                scores[this.moves[nextIdx]] += 2.0;
            }
            for (const [diff, count] of Object.entries(diffCounts)) {
                const d = parseInt(diff);
                const nextIdx = (lastIdx + d) % 3;
                const weight = count / len;
                scores[this.moves[nextIdx]] += weight * 1.5;
            }
        }

        // ---- 絶対遷移 ----
        const transitionCounts = {};
        for (let i = 1; i < len; i++) {
            const key = this.moves[this.history[i - 1]] + ',' + this.moves[this.history[i]];
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
        const lastMove = this.moves[lastIdx];
        for (const [key, count] of Object.entries(transitionCounts)) {
            const [prev, next] = key.split(',');
            if (prev === lastMove) {
                scores[next] += count * 0.8;
            }
        }

        // ---- 直近傾向 ----
        const recent = this.history.slice(-5);
        if (recent.length > 0) {
            const freq = {};
            for (const idx of recent) {
                const m = this.moves[idx];
                freq[m] = (freq[m] || 0) + 1;
            }
            for (const m of this.moves) {
                scores[m] += (freq[m] || 0) / recent.length * 1.0;
            }
        }

        // ---- 全局傾向 ----
        if (len > 0) {
            const freq = {};
            for (const idx of this.history) {
                const m = this.moves[idx];
                freq[m] = (freq[m] || 0) + 1;
            }
            for (const m of this.moves) {
                scores[m] += (freq[m] || 0) / len * 0.5;
            }
        }

        // ---- 連続ペナルティ ----
        scores[this.moves[lastIdx]] -= 0.3;

        // ---- 🆕 ランダム判定：スコアが均等ならランダムと判断 ----
        const scoreValues = Object.values(scores);
        const maxScore = Math.max(...scoreValues);
        const minScore = Math.min(...scoreValues);
        const isRandom = (maxScore - minScore) < 0.5; // スコアの差が小さい＝ランダム

        if (isRandom) {
            // ランダムと判断したら、前回の手を避ける（前回と同じ手にはペナルティ）
            const candidates = this.moves.filter(m => m !== this.moves[lastIdx]);
            // さらに、ランダムに選ぶ（完全にランダムではなく、少し偏りを持たせる）
            // ここでは単純に候補からランダム選択
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        // ---- 通常の最高スコア選択 ----
        let bestScore = -Infinity;
        let bestMoves = [];
        for (const [move, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        if (bestScore <= 0) {
            const freq = {};
            for (const idx of this.history) {
                const m = this.moves[idx];
                freq[m] = (freq[m] || 0) + 1;
            }
            let maxF = 0, best = this.moves[0];
            for (const [m, c] of Object.entries(freq)) {
                if (c > maxF) { maxF = c; best = m; }
            }
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
    }
}