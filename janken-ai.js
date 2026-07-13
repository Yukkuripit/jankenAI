// 先頭に追加
console.log('✅ janken-ai.js 読み込み完了');
// もし debugLog が使えれば（main.jsより後に読み込まれるので注意）

// ============================================================
//  ファイル: janken-ai.js
//  役割: じゃんけんAI（D1統計データを学習に使える版）
// ============================================================

class JankenAI {
    constructor() {
        this.MAX_HISTORY = 50;
        this.moves = ['グー', 'チョキ', 'パー'];
        this.moveIndex = { 'グー': 0, 'チョキ': 1, 'パー': 2 };
        this.history = [];

        // ---- D1から読み込んだ統計データ（カウント） ----
        this.loadedCounts = {
            moves: { 'グー': 0, 'チョキ': 0, 'パー': 0 },
            diff: { '0': 0, '1': 0, '2': 0 }
        };

        this.winMap = {
            'グー': 'パー',
            'チョキ': 'グー',
            'パー': 'チョキ'
        };
        this.firstMoveBias = 'グー';
    }

    // ---- D1統計データを読み込む ----
    loadStats(stats) {
        if (stats) {
            this.loadedCounts.moves = stats.moves || { 'グー': 0, 'チョキ': 0, 'パー': 0 };
            this.loadedCounts.diff = stats.diff || { '0': 0, '1': 0, '2': 0 };
        } else {
            this.loadedCounts.moves = { 'グー': 0, 'チョキ': 0, 'パー': 0 };
            this.loadedCounts.diff = { '0': 0, '1': 0, '2': 0 };
        }
    }

    // ---- 現在の統計データをエクスポート（保存用） ----
    exportStats() {
        // 履歴から現在のカウントを算出（loadedCounts + 新規プレイ分）
        const moves = { ...this.loadedCounts.moves };
        const diff = { ...this.loadedCounts.diff };

        // 履歴があればそれも加算（ただし履歴は直近50件のみなので、長期の統計はloadedCountsに頼る）
        // ここでは、loadedCountsがベース＋履歴の差分を加算する方式にする
        // 単純にloadedCountsを返す（履歴は一時的な学習用で、統計には含めない）
        return {
            moves: moves,
            diff: diff
        };
    }

    // ---- 相手の手を学習（履歴＋カウント更新） ----
    observe(playerMove) {
        const currentIdx = this.moveIndex[playerMove];
        this.history.push(currentIdx);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }

        // D1用カウントも更新（保存時はこちらを使う）
        this.loadedCounts.moves[playerMove] = (this.loadedCounts.moves[playerMove] || 0) + 1;
        if (this.history.length >= 2) {
            const prevIdx = this.history[this.history.length - 2];
            const diff = ((currentIdx - prevIdx) % 3 + 3) % 3;
            this.loadedCounts.diff[String(diff)] = (this.loadedCounts.diff[String(diff)] || 0) + 1;
        }
    }

    // ---- 予測（履歴＋D1統計を統合） ----
    predict() {
        const len = this.history.length;
        if (len === 0) {
            // 履歴がない場合、D1統計から最多手を予測
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

        const lastIdx = this.history[len - 1];
        const scores = { 'グー': 0, 'チョキ': 0, 'パー': 0 };

        // ---- 1. D1統計からの差分パターン ----
        const totalDiff = Object.values(this.loadedCounts.diff).reduce((a, b) => a + b, 0);
        if (totalDiff > 0) {
            for (const [diff, count] of Object.entries(this.loadedCounts.diff)) {
                const d = parseInt(diff);
                const nextIdx = (lastIdx + d) % 3;
                const weight = count / totalDiff;
                scores[this.moves[nextIdx]] += weight * 2.0;
            }
        }

        // ---- 2. 履歴からの差分パターン（直近） ----
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
                scores[this.moves[nextIdx]] += 1.5;
            }
            for (const [diff, count] of Object.entries(diffCounts)) {
                const d = parseInt(diff);
                const nextIdx = (lastIdx + d) % 3;
                const weight = count / len;
                scores[this.moves[nextIdx]] += weight * 1.0;
            }
        }

        // ---- 3. D1統計からの全局傾向 ----
        const totalMoves = Object.values(this.loadedCounts.moves).reduce((a, b) => a + b, 0);
        if (totalMoves > 0) {
            for (const move of this.moves) {
                scores[move] += (this.loadedCounts.moves[move] || 0) / totalMoves * 0.5;
            }
        }

        // ---- 4. 直近傾向 ----
        const recent = this.history.slice(-5);
        if (recent.length > 0) {
            const freq = {};
            for (const idx of recent) {
                const m = this.moves[idx];
                freq[m] = (freq[m] || 0) + 1;
            }
            for (const m of this.moves) {
                scores[m] += (freq[m] || 0) / recent.length * 0.8;
            }
        }

        // ---- 5. 連続ペナルティ ----
        scores[this.moves[lastIdx]] -= 0.3;

        // ---- ランダム判定 ----
        const scoreValues = Object.values(scores);
        const maxScore = Math.max(...scoreValues);
        const minScore = Math.min(...scoreValues);
        const isRandom = (maxScore - minScore) < 0.5;

        if (isRandom) {
            const candidates = this.moves.filter(m => m !== this.moves[lastIdx]);
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        // ---- 最高スコア選択 ----
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
        // D1統計はリセットしない（明示的にリセットする場合は別途）
    }
    // janken-ai.js の一番最後にこれを追加（クラスが正しく定義されているか確認）
    alert('✅ JankenAI クラス定義完了');
}