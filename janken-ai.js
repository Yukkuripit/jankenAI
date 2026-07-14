// ============================================================
//  ファイル: janken-ai.js
//  役割: じゃんけん特化AI (配置思考ゼロ版)
//  特徴: 差分パターン(配置順序)を完全無効化
//        メタ予測強度85%で相手の読みを読む
// ============================================================

class JankenAI {
    constructor() {
        this.MAX_HISTORY = 150;
        this.moves = ['グー', 'チョキ', 'パー'];
        this.moveIndex = { 'グー': 0, 'チョキ': 1, 'パー': 2 };
        this.history = [];

        // 勝ちマップ
        this.winMap = {
            'グー': 'パー',
            'チョキ': 'グー',
            'パー': 'チョキ'
        };

        // 負けマップ（相手の手に対して負ける手）
        this.loseMap = {
            'グー': 'チョキ',
            'チョキ': 'パー',
            'パー': 'グー'
        };

        // 相手の手に勝つための手
        this.beats = {
            'グー': 'パー',
            'チョキ': 'グー',
            'パー': 'チョキ'
        };

        this.firstMoveBias = 'グー';
        this.firstHandBias = {
            'グー': 0.36,
            'チョキ': 0.33,
            'パー': 0.31
        };
        this.transitionBias = {
            'グー': { 'グー': 0.30, 'チョキ': 0.38, 'パー': 0.32 },
            'チョキ': { 'グー': 0.35, 'チョキ': 0.28, 'パー': 0.37 },
            'パー': { 'グー': 0.33, 'チョキ': 0.36, 'パー': 0.31 }
        };

        // 外し率（0〜1）：デフォルト15%
        this.missRate = 0.15;
        // メタ予測強度（0〜1）：85%で相手の読みを考慮
        this.metaStrength = 0.85;
    }

    // ----- 相手の手を学習 -----
    observe(playerMove) {
        const idx = this.moveIndex[playerMove];
        this.history.push(idx);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }

    // ----- 相手の次の手の確率分布を計算（配置順序を完全無視） -----
    predictDistribution() {
        const len = this.history.length;
        const scores = { 'グー': 0, 'チョキ': 0, 'パー': 0 };

        // 初手
        if (len === 0) {
            for (const [move, prob] of Object.entries(this.firstHandBias)) {
                scores[move] = prob;
            }
            return this._normalize(scores);
        }

        const lastIdx = this.history[len - 1];
        const lastMove = this.moves[lastIdx];

        // ---- 2回目（履歴1件） ----
        if (len === 1) {
            const bias = this.transitionBias[lastMove] || { 'グー': 0.33, 'チョキ': 0.33, 'パー': 0.34 };
            for (const [move, prob] of Object.entries(bias)) {
                scores[move] += prob * 3.0;
            }
            for (const [move, prob] of Object.entries(this.firstHandBias)) {
                scores[move] += prob * 0.5;
            }
            scores[lastMove] -= 0.3;
            return this._normalize(scores);
        }

        // ---- 🔽 差分パターン（配置順序）を完全に無効化！ ----
        // 従来の差分カウント処理をすべてコメントアウト or 削除
        // 代わりに絶対遷移（直前の手→次の手）のみを使用

        // ---- 1. 絶対遷移（直前の手→次の手） ----
        const transitionCounts = {};
        for (let i = 1; i < len; i++) {
            const key = this.moves[this.history[i - 1]] + ',' + this.moves[this.history[i]];
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
        for (const [key, count] of Object.entries(transitionCounts)) {
            const [prev, next] = key.split(',');
            if (prev === lastMove) {
                scores[next] += count * 1.5; // 重みUP
            }
        }

        // ---- 2. 直近傾向（直近5回） ----
        const recent = this.history.slice(-5);
        if (recent.length > 0) {
            const freq = {};
            for (const idx of recent) {
                const m = this.moves[idx];
                freq[m] = (freq[m] || 0) + 1;
            }
            for (const m of this.moves) {
                scores[m] += (freq[m] || 0) / recent.length * 1.2;
            }
        }

        // ---- 3. 全局傾向（全履歴） ----
        if (len > 0) {
            const freq = {};
            for (const idx of this.history) {
                const m = this.moves[idx];
                freq[m] = (freq[m] || 0) + 1;
            }
            for (const m of this.moves) {
                scores[m] += (freq[m] || 0) / len * 1.0;
            }
        }

        // ---- 4. 連続ペナルティ（同じ手を出しにくいバイアス） ----
        scores[lastMove] -= 0.3;

        // ---- 5. 履歴が少ない場合のバイアス補強 ----
        if (len <= 4) {
            const bias = this.transitionBias[lastMove] || { 'グー': 0.33, 'チョキ': 0.33, 'パー': 0.34 };
            const biasWeight = Math.max(0.3, 1.0 - (len - 1) * 0.25);
            for (const [move, prob] of Object.entries(bias)) {
                scores[move] += prob * biasWeight * 2.0;
            }
        }

        return this._normalize(scores);
    }

    // ----- スコアを正規化（確率分布に変換） -----
    _normalize(scores) {
        const values = Object.values(scores);
        const minVal = Math.min(...values);
        const shifted = {};
        let sum = 0;
        for (const [move, score] of Object.entries(scores)) {
            const s = Math.max(0, score - minVal + 0.01);
            shifted[move] = s;
            sum += s;
        }
        if (sum === 0) {
            for (const m of this.moves) shifted[m] = 1 / this.moves.length;
            return shifted;
        }
        const result = {};
        for (const [move, s] of Object.entries(shifted)) {
            result[move] = s / sum;
        }
        return result;
    }

    // ----- メタ予測：相手の読みを読んで最適手を選択 -----
    getAIMove() {
        // 1. 相手が次に出す確率分布を取得
        const opponentDist = this.predictDistribution();

        // 2. AIが各手を出した場合の「直接勝率」を計算
        const directWinRates = {};
        for (const aiMove of this.moves) {
            let winProb = 0;
            for (const [oppMove, prob] of Object.entries(opponentDist)) {
                if (this.winMap[aiMove] === oppMove) {
                    winProb += prob;
                } else if (aiMove === oppMove) {
                    winProb += prob * 0.5;
                }
            }
            directWinRates[aiMove] = winProb;
        }

        // 3. メタ予測：相手がAIの手を予測して勝とうとする場合を考慮
        const metaWinRates = {};
        for (const aiMove of this.moves) {
            const opponentCounter = this.beats[aiMove]; // AIの手に勝つ手
            let metaWinProb = 0;
            for (const [oppMove, prob] of Object.entries(opponentDist)) {
                if (oppMove === opponentCounter) {
                    metaWinProb += 0;
                } else if (oppMove === aiMove) {
                    metaWinProb += prob * 0.5;
                } else {
                    metaWinProb += prob * 1.0;
                }
            }

            const finalWinRate = (1 - this.metaStrength) * directWinRates[aiMove] +
                                 this.metaStrength * metaWinProb;
            metaWinRates[aiMove] = finalWinRate;
        }

        // 4. 最も勝率の高い手を選択
        let bestMove = null;
        let bestRate = -Infinity;
        for (const [move, rate] of Object.entries(metaWinRates)) {
            if (rate > bestRate) {
                bestRate = rate;
                bestMove = move;
            }
        }

        // 5. 外し率
        if (Math.random() < this.missRate) {
            const others = this.moves.filter(m => m !== bestMove);
            return others[Math.floor(Math.random() * others.length)];
        }

        return bestMove || this.moves[0];
    }

    // ----- 1ラウンド実行 -----
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