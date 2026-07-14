// ============================================================
//  ファイル: main.js
//  役割: UI制御・モード切替・思考時間制御
//  特徴: クールダウンを「思考時間」として強制化（1秒）
// ============================================================

// ----- 定数 -----
const THINKING_MS = 1000;
const DIFFICULTY_LABELS = ['弱い', 'やや弱い', '普通', 'やや強い', '強い'];
const RARE_MESSAGE_RATE = 0.05; // 10%の確率でレアメッセージ

// ----- API設定（Cloudflare PagesのURLに変更） -----
const API_BASE = 'https://your-pages-project.pages.dev';

// ----- 状態管理 -----
const state = {
    jankenAI: new JankenAI(),
    acchiAI: new AcchiMuiteAI(),
    currentMode: 'normal',
    jankenStats: { playerWins: 0, aiWins: 0, draws: 0 },
    acchiStats: { playerWins: 0, aiWins: 0 },
    roundResults: [],
    acchiPhase: { active: false, playerRole: null, aiRole: null },
    acchiOnlyProcessing: false,
    // 🆕 思考中フラグ
    isThinking: false,
    theme: 'light'
};

// ----- DOM参照（クールダウン関連削除） -----
const dom = {
    playerHand: document.getElementById('player-hand'),
    aiHand: document.getElementById('ai-hand'),
    resultMsg: document.getElementById('result-message'),
    historyList: document.getElementById('history-list'),
    playerWins: document.getElementById('player-wins'),
    aiWins: document.getElementById('ai-wins'),
    draws: document.getElementById('draws'),
    winRate: document.getElementById('win-rate'),
    acchiStatus: document.getElementById('acchi-status'),
    acchiPlayerDir: document.getElementById('acchi-player-dir'),
    acchiAiDir: document.getElementById('acchi-ai-dir'),
    acchiPlayerRole: document.getElementById('acchi-player-role'),
    acchiAiRole: document.getElementById('acchi-ai-role'),
    acchiResult: document.getElementById('acchi-result'),
    acchiPlayerScore: document.getElementById('acchi-player-score'),
    acchiAiScore: document.getElementById('acchi-ai-score'),
    resetBtn: document.getElementById('reset-btn'),
    jankenArea: document.getElementById('janken-area'),
    acchiArea: document.getElementById('acchi-area'),
    jankenButtons: document.getElementById('janken-buttons'),
    acchiPad: document.getElementById('acchi-pad'),
    modeRadios: document.querySelectorAll('input[name="game-mode"]'),
    themeToggle: document.getElementById('theme-toggle'),
    difficultySlider: document.getElementById('difficulty-slider'),
    difficultyValue: document.getElementById('difficulty-value'),
    // 🆕 思考中インジケーター
    thinkingIndicator: document.getElementById('thinking-indicator'),
    thinkingLabel: document.getElementById('thinking-label')  // 🆕 追加
};

// ----- ヘルパー -----
function getEmoji(hand) {
    const map = { 'グー': '✊', 'チョキ': '✌️', 'パー': '✋' };
    return map[hand] || '❓';
}
function getDirEmoji(dir) {
    const map = { '上': '⬆️', '下': '⬇️', '左': '⬅️', '右': '➡️' };
    return map[dir] || '❓';
}
function resultToLabel(result) {
    const map = {
        'ai_win': '🤖 AIの勝ち',
        'player_win': '😎 あなたの勝ち',
        'draw': '🤝 引き分け'
    };
    return map[result] || result;
}
function getRandomRole() { return Math.random() < 0.5 ? 'pointer' : 'mover'; }
function getOppositeRole(r) { return r === 'pointer' ? 'mover' : 'pointer'; }

// ----- ユーザーID管理（DB連携用） -----
function getUserId() {
    let id = localStorage.getItem('janken_user_id');
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() :
             'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('janken_user_id', id);
    }
    return id;
}

// ----- サーバー通信 -----
async function fetchStatsFromServer(userId) {
    try {
        const res = await fetch(`${API_BASE}/api/stats?user_id=${userId}`);
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    } catch (e) {
        console.warn('サーバーからのデータ取得失敗', e);
        return null;
    }
}
async function sendStatsToServer(userId, jankenStats, acchiStats) {
    try {
        const res = await fetch(`${API_BASE}/api/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, janken: jankenStats, acchi: acchiStats })
        });
        return await res.json();
    } catch (e) {
        console.warn('サーバーへのデータ送信失敗', e);
        return null;
    }
}

// ----- AIデータ適用・エクスポート -----
function applyStatsToJankenAI(ai, stats) {
    if (!stats || !stats.janken) return;
    const j = stats.janken;
    const history = [];
    for (const [move, count] of Object.entries(j.counts || {})) {
        for (let i = 0; i < Math.min(count, 20); i++) {
            history.push(ai.moveIndex[move]);
        }
    }
    ai.history = history.slice(-ai.MAX_HISTORY);
    ai.diffCounts = {};
    for (const [diff, count] of Object.entries(j.diffCounts || {})) {
        ai.diffCounts[parseInt(diff)] = count;
    }
    ai.transitionCounts = {};
    for (const [from, toMap] of Object.entries(j.transitions || {})) {
        for (const [to, count] of Object.entries(toMap)) {
            ai.transitionCounts[from + ',' + to] = count;
        }
    }
}
function applyStatsToAcchiAI(ai, stats) {
    if (!stats || !stats.acchi) return;
    const a = stats.acchi;
    const history = [];
    for (const [dir, count] of Object.entries(a.counts || {})) {
        for (let i = 0; i < Math.min(count, 20); i++) {
            history.push(ai.dirIndex[dir]);
        }
    }
    ai.opponentHistory = history.slice(-ai.MAX_HISTORY);
    ai.diffCounts = {};
    for (const [diff, count] of Object.entries(a.diffCounts || {})) {
        ai.diffCounts[parseInt(diff)] = count;
    }
    ai.transitionCounts = {};
    for (const [from, toMap] of Object.entries(a.transitions || {})) {
        for (const [to, count] of Object.entries(toMap)) {
            ai.transitionCounts[from + ',' + to] = count;
        }
    }
}
function exportStatsFromJankenAI(ai) {
    const counts = {};
    for (const idx of ai.history) {
        const m = ai.moves[idx];
        counts[m] = (counts[m] || 0) + 1;
    }
    const transitions = {};
    for (let i = 1; i < ai.history.length; i++) {
        const from = ai.moves[ai.history[i - 1]];
        const to = ai.moves[ai.history[i]];
        if (!transitions[from]) transitions[from] = {};
        transitions[from][to] = (transitions[from][to] || 0) + 1;
    }
    const diffCounts = {};
    for (let i = 1; i < ai.history.length; i++) {
        const diff = ((ai.history[i] - ai.history[i - 1]) % 3 + 3) % 3;
        diffCounts[diff] = (diffCounts[diff] || 0) + 1;
    }
    return { counts, transitions, diffCounts, totalPlays: ai.history.length };
}
function exportStatsFromAcchiAI(ai) {
    const counts = {};
    for (const idx of ai.opponentHistory) {
        const d = ai.directions[idx];
        counts[d] = (counts[d] || 0) + 1;
    }
    const transitions = {};
    for (let i = 1; i < ai.opponentHistory.length; i++) {
        const from = ai.directions[ai.opponentHistory[i - 1]];
        const to = ai.directions[ai.opponentHistory[i]];
        if (!transitions[from]) transitions[from] = {};
        transitions[from][to] = (transitions[from][to] || 0) + 1;
    }
    const diffCounts = {};
    for (let i = 1; i < ai.opponentHistory.length; i++) {
        const diff = ((ai.opponentHistory[i] - ai.opponentHistory[i - 1]) % 4 + 4) % 4;
        diffCounts[diff] = (diffCounts[diff] || 0) + 1;
    }
    return { counts, transitions, diffCounts, totalPlays: ai.opponentHistory.length };
}
async function syncStatsToServer() {
    const userId = getUserId();
    const j = exportStatsFromJankenAI(state.jankenAI);
    const a = exportStatsFromAcchiAI(state.acchiAI);
    await sendStatsToServer(userId, j, a);
}
async function loadAIFromServer() {
    const userId = getUserId();
    const data = await fetchStatsFromServer(userId);
    if (data) {
        applyStatsToJankenAI(state.jankenAI, data);
        applyStatsToAcchiAI(state.acchiAI, data);
        console.log('✅ サーバーからデータをロードしました');
    }
    return userId;
}

// ----- 難易度制御 -----
function getMissRate(difficulty) {
    return 40 - (difficulty / 100) * 40;
}
function updateDifficulty() {
    const val = parseInt(dom.difficultySlider.value);
    const labelIndex = Math.floor(val / 25);
    dom.difficultyValue.textContent = DIFFICULTY_LABELS[Math.min(labelIndex, 4)];
    const missRate = getMissRate(val) / 100;
    const metaStrength = 0.5 + (val / 100) * 0.4;
    state.jankenAI.missRate = missRate;
    state.jankenAI.metaStrength = metaStrength;
    state.acchiAI.missRate = missRate;
}
function initDifficultySlider() {
    dom.difficultySlider.addEventListener('input', updateDifficulty);
    updateDifficulty();
}

const thinkingMessages = [
    '🤔 相手のクセを分析中...',
    '🧠 過去のパターンを照合中...',
    '📊 勝率を計算中...',
    '🎯 最適な一手を選定中...',
    '🔄 相手の読みを読んでる...',
    '📈 統計データを解析中...',
    '⚡ 最善手をシミュレート中...',
    '🔮 次の一手を予測中...',
    '🧮 確率を計算中...',
    '🎲 戦略を練り直し中...',
    '👀 相手の視線を追跡中...',
    '🎯 狙う方向を絞り込み中...',
    '🧭 最適な方向を探索中...'
];

// ----- 🆕 レアメッセージ（低確率で出現） -----
const rareMessages = [
    // SF・宇宙系
    '🌌 銀河のエネルギーを使用中...',
    '🚀 超次元計算を実行中...',
    '🪐 土星の輪からデータ取得中...',
    '🌠 星の動きを解析中...',
    '🌀 時空の歪みを計算中...',
    '💫 ブラックホール戦略を展開中...',
    '🔭 遠い星の観測結果を反映中...',
    '🌞 太陽フレアの影響を考慮中...',
    '🛸 宇宙人のアドバイスを受信中...',
    '✨ 量子もつれを利用した予測中...',
    // ギャグ・ネタ系
    '🎭 役割をランダムに再設定中（やけくそ）',
    '😎 AIが余裕をこいてるだけです',
    '🍵 お茶を飲みながら考え中...',
    '💤 ちょっと休憩中...（嘘です）',
    '🤖 自分が何を出そうか迷ってます',
    '🎲 サイコロ振って決めようかな...',
    '💭 今日の晩ごはん考えてた...',
    '🎪 サーカスのピエロと相談中...',
    '🧙 魔法の呪文を唱え中...',
    '🍣 寿司食べながら戦略中...'
];

// ----- 🆕 メッセージ取得関数（低確率でレアメッセージ） -----
function getThinkingMessage() {
    if (Math.random() < RARE_MESSAGE_RATE) {
        return rareMessages[Math.floor(Math.random() * rareMessages.length)];
    }
    return thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
}

// ----- 思考中インジケーター制御 -----
function showThinking() {
    try {
        const msg = getThinkingMessage();
        if (dom.thinkingLabel) {
            dom.thinkingLabel.textContent = msg;
        } else {
            console.warn('⚠️ dom.thinkingLabel が見つかりません');
        }
        if (dom.thinkingIndicator) {
            dom.thinkingIndicator.classList.add('active');
        }
        state.isThinking = true;
    } catch (e) {
        console.error('思考表示エラー:', e);
        state.isThinking = false;
    }
}

function hideThinking() {
    try {
        if (dom.thinkingIndicator) {
            dom.thinkingIndicator.classList.remove('active');
        }
    } catch (e) {
        console.warn('思考非表示エラー:', e);
    }
    state.isThinking = false;
}

// ----- 🆕 強制タイムアウト付き思考待機 -----
function waitForThinking() {
    return new Promise((resolve) => {
        showThinking();

        // 通常のタイマー（1000ms）
        const timer = setTimeout(() => {
            hideThinking();
            resolve();
        }, THINKING_MS);

        // 🆕 強制タイムアウト（1500msで強制解除）
        const forceTimer = setTimeout(() => {
            clearTimeout(timer); // 通常タイマーをキャンセル
            hideThinking();
            console.warn('⚠️ 思考強制解除（タイムアウト）');
            resolve();
        }, THINKING_MS + 500); // 1.5秒で強制解除
    });
}

function forceStopThinking() {
    if (state.isThinking) {
        hideThinking();
        state.isThinking = false;
        console.log('🧹 思考状態を強制リセットしました');
    }
}

// ----- テーマ -----
function setTheme(theme) {
    state.theme = theme;
    document.body.classList.toggle('dark-mode', theme === 'dark');
    dom.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    try { localStorage.setItem('janken-theme', theme); } catch (e) {}
}
function toggleTheme() {
    setTheme(state.theme === 'light' ? 'dark' : 'light');
}
function loadTheme() {
    let saved = 'light';
    try { saved = localStorage.getItem('janken-theme') || 'light'; } catch (e) {}
    if (!saved) {
        saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    setTheme(saved);
}

// ----- スコア・履歴 -----
function updateJankenScore() {
    const s = state.jankenStats;
    dom.playerWins.textContent = s.playerWins;
    dom.aiWins.textContent = s.aiWins;
    dom.draws.textContent = s.draws;
    const total = s.playerWins + s.aiWins + s.draws;
    dom.winRate.textContent = total === 0 ? '0%' : `${Math.round((s.aiWins / total) * 100)}%`;
}
function updateHistory() {
    const list = dom.historyList;
    list.innerHTML = '';
    const results = state.roundResults;
    if (results.length === 0) {
        const empty = document.createElement('span');
        empty.textContent = 'まだ対戦がありません';
        empty.style.color = 'var(--text-light)';
        empty.style.fontSize = '0.9rem';
        list.appendChild(empty);
        return;
    }
    const start = Math.max(0, results.length - 10);
    for (let i = start; i < results.length; i++) {
        const r = results[i];
        const tag = document.createElement('span');
        tag.className = 'history-tag';
        const cls = r.result === 'ai_win' ? 'lose' : (r.result === 'player_win' ? 'win' : 'draw');
        const label = r.result === 'ai_win' ? '負け' : (r.result === 'player_win' ? '勝ち' : '引分');
        tag.innerHTML = `${getEmoji(r.player)} vs ${getEmoji(r.ai)} <span class="${cls}">${label}</span>`;
        list.appendChild(tag);
    }
}
function updateAcchiScore() {
    dom.acchiPlayerScore.textContent = state.acchiStats.playerWins;
    dom.acchiAiScore.textContent = state.acchiStats.aiWins;
}

// ----- あっちむいてホイ制御 -----
function resetAcchiUI(msg = '👀 じゃんけんで勝敗が決まったら始まります！') {
    dom.acchiStatus.textContent = msg;
    dom.acchiPlayerDir.textContent = '❓';
    dom.acchiAiDir.textContent = '❓';
    dom.acchiPlayerRole.textContent = '（役割未定）';
    dom.acchiAiRole.textContent = '（役割未定）';
    dom.acchiResult.textContent = '⏳ 準備中...';
    dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
    state.acchiPhase.active = false;
}
function enableJankenButtons(enabled) {
    dom.jankenButtons.querySelectorAll('.hand-btn').forEach(b => b.disabled = !enabled);
}
function startAcchiPhase(jankenResult) {
    if (state.currentMode !== 'normal') return;
    if (jankenResult === 'draw') {
        resetAcchiUI('🤝 引き分け！もう一度じゃんけんをしてください。');
        enableJankenButtons(true);
        return;
    }
    const isPlayerWin = jankenResult === 'player_win';
    const playerRole = isPlayerWin ? 'pointer' : 'mover';
    const aiRole = isPlayerWin ? 'mover' : 'pointer';
    state.acchiPhase.active = true;
    state.acchiPhase.playerRole = playerRole;
    state.acchiPhase.aiRole = aiRole;
    dom.acchiStatus.textContent = isPlayerWin ? '🎯 あなたの勝ち！ あなたは「指す側」です。' : '🤖 AIの勝ち！ あなたは「動かす側」です。';
    dom.acchiPlayerRole.textContent = playerRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
    dom.acchiAiRole.textContent = aiRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
    dom.acchiResult.textContent = '👉 方向を選んでください！';
    dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = false);
    enableJankenButtons(false);
}
// ----- あっちむいてホイ 連続モード用：ラウンド開始（思考時間なしで即座に開始） -----
function startAcchiOnlyRound() {
    if (state.currentMode !== 'acchi_only' || state.acchiOnlyProcessing) return;
    const playerRole = getRandomRole();
    const aiRole = getOppositeRole(playerRole);
    state.acchiPhase.active = true;
    state.acchiPhase.playerRole = playerRole;
    state.acchiPhase.aiRole = aiRole;
    dom.acchiPlayerRole.textContent = playerRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
    dom.acchiAiRole.textContent = aiRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
    dom.acchiPlayerDir.textContent = '❓';
    dom.acchiAiDir.textContent = '❓';
    dom.acchiResult.textContent = '👉 方向を選んでください！';
    dom.acchiStatus.textContent = playerRole === 'pointer' ? '🎯 あなたは「指す側」です。' : '🙆 あなたは「動かす側」です。';
    dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = false);
}
// ----- 🆕 あっちむいてホイ プレイ（思考時間付き） -----
// ----- あっちむいてホイ プレイ（エラーハンドリング強化） -----
async function playAcchi(playerDir) {
    if (state.isThinking) return;
    if (!state.acchiPhase.active) return alert('現在フェーズではありません。');
    if (state.currentMode === 'acchi_only' && state.acchiOnlyProcessing) return;

    dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
    enableJankenButtons(false);

    try {
        dom.acchiResult.textContent = '🤔 AIが考え中...';
        await waitForThinking();

        if (state.currentMode === 'acchi_only') state.acchiOnlyProcessing = true;

        const playerRole = state.acchiPhase.playerRole;
        const aiRole = state.acchiPhase.aiRole;
        const aiDir = state.acchiAI.play(aiRole, playerDir);

        dom.acchiPlayerDir.textContent = getDirEmoji(playerDir);
        dom.acchiAiDir.textContent = getDirEmoji(aiDir);

        let msg = '';
        if (playerRole === 'pointer') {
            if (playerDir === aiDir) {
                msg = '🎉 一致！ あなたの勝ち！';
                state.acchiStats.playerWins++;
            } else {
                msg = '😵 外れた！ AIの勝ち！';
                state.acchiStats.aiWins++;
            }
        } else {
            if (aiDir === playerDir) {
                msg = '💀 一致！ AIの勝ち！';
                state.acchiStats.aiWins++;
            } else {
                msg = '🙌 避けた！ あなたの勝ち！';
                state.acchiStats.playerWins++;
            }
        }
        dom.acchiResult.textContent = msg;
        updateAcchiScore();

        state.acchiPhase.active = false;

        if (state.currentMode === 'normal') {
            dom.acchiStatus.textContent = '✅ あっちむいてホイ終了！ 次のじゃんけんをしてください。';
            enableJankenButtons(true);
            state.acchiOnlyProcessing = false;
        } else if (state.currentMode === 'acchi_only') {
            dom.acchiStatus.textContent = '🔄 次のラウンド準備完了！';
            const newPR = getRandomRole();
            const newAR = getOppositeRole(newPR);
            state.acchiPhase.playerRole = newPR;
            state.acchiPhase.aiRole = newAR;
            state.acchiPhase.active = true;
            dom.acchiPlayerRole.textContent = newPR === 'pointer' ? '👉 指す側' : '🙆 動かす側';
            dom.acchiAiRole.textContent = newAR === 'pointer' ? '👉 指す側' : '🙆 動かす側';
            dom.acchiResult.textContent = '👉 次の方向を選んでください！';
            dom.acchiStatus.textContent = newPR === 'pointer' ? '🎯 あなたは「指す側」です。' : '🙆 あなたは「動かす側」です。';
            dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = false);
            state.acchiOnlyProcessing = false;
        }
    } catch (e) {
        console.error('あっちむいてホイ処理エラー:', e);
        forceStopThinking();
        dom.acchiResult.textContent = '⚠️ エラーが発生しました。もう一度お試しください。';
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = false);
    }
}

// ----- 🆕 じゃんけんメイン（思考時間付き） -----
// ----- じゃんけんメイン（エラーハンドリング強化） -----
async function handleJankenPlay(playerMove) {
    if (state.isThinking) return;

    // ボタンを即座に無効化
    enableJankenButtons(false);
    dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);

    try {
        // 思考時間
        dom.resultMsg.textContent = '🤔 AIが考え中...';
        await waitForThinking();

        // AIの手を決定
        const result = state.jankenAI.play(playerMove);

        // 結果表示
        state.roundResults.push({ player: playerMove, ai: result.aiMove, result: result.result });
        const s = state.jankenStats;
        if (result.result === 'player_win') s.playerWins++;
        else if (result.result === 'ai_win') s.aiWins++;
        else if (result.result === 'draw') s.draws++;
        dom.playerHand.textContent = getEmoji(playerMove);
        dom.aiHand.textContent = getEmoji(result.aiMove);
        dom.resultMsg.textContent = resultToLabel(result.result);
        updateJankenScore();
        updateHistory();

        if (state.roundResults.length % 5 === 0) await syncStatsToServer();

        if (state.currentMode === 'janken_only') {
            resetAcchiUI('⏭ じゃんけん連続モード中');
            dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
            enableJankenButtons(true);
            dom.resultMsg.textContent = '👋 次の手を選んでください！';
        } else if (state.currentMode === 'normal') {
            resetAcchiUI();
            startAcchiPhase(result.result);
        }
    } catch (e) {
        console.error('じゃんけん処理エラー:', e);
        // エラー時は強制復旧
        forceStopThinking();
        enableJankenButtons(true);
        dom.resultMsg.textContent = '⚠️ エラーが発生しました。もう一度お試しください。';
    }
}

// ----- モード切替 -----
function switchMode(mode) {
    forceStopThinking();

    state.currentMode = mode;
    state.acchiPhase.active = false;
    state.acchiOnlyProcessing = false;
    dom.jankenArea.classList.remove('game-area-disabled');
    dom.acchiArea.classList.remove('game-area-disabled');
    if (mode === 'normal') {
        enableJankenButtons(true);
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
        resetAcchiUI('👀 じゃんけんで勝敗が決まったら、方向を選びます。');
        dom.resultMsg.textContent = '👋 手を選んで対戦開始！';
        dom.playerHand.textContent = '❓';
        dom.aiHand.textContent = '❓';
    } else if (mode === 'janken_only') {
        dom.acchiArea.classList.add('game-area-disabled');
        enableJankenButtons(true);
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
        resetAcchiUI('⏭ じゃんけん連続モード中（あっちむいてホイはオフ）');
        dom.resultMsg.textContent = '👋 手を選んでじゃんけん連続！';
        dom.playerHand.textContent = '❓';
        dom.aiHand.textContent = '❓';
        dom.acchiPlayerDir.textContent = '❓';
        dom.acchiAiDir.textContent = '❓';
        dom.acchiPlayerRole.textContent = '（無効）';
        dom.acchiAiRole.textContent = '（無効）';
        dom.acchiResult.textContent = '⏸ スキップ中';
    } else if (mode === 'acchi_only') {
        dom.jankenArea.classList.add('game-area-disabled');
        enableJankenButtons(false);
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
        resetAcchiUI('🔄 あっちむいてホイ連続モード！');
        dom.resultMsg.textContent = '⏸ じゃんけんはスキップ中';
        dom.playerHand.textContent = '⏸';
        dom.aiHand.textContent = '⏸';
        setTimeout(() => {
            if (state.currentMode === 'acchi_only') startAcchiOnlyRound();
        }, 300);
    }
    updateJankenScore();
    updateHistory();
    updateAcchiScore();
}

// ----- リセット -----
async function handleReset() {
    forceStopThinking();
    if (!confirm('すべての記憶とスコアをリセットしますか？')) return;
    state.jankenAI.reset();
    state.acchiAI.reset();
    state.jankenStats = { playerWins: 0, aiWins: 0, draws: 0 };
    state.acchiStats = { playerWins: 0, aiWins: 0 };
    state.roundResults = [];
    state.acchiPhase.active = false;
    state.acchiOnlyProcessing = false;
    state.isThinking = false;
    dom.thinkingIndicator.classList.remove('active');
    dom.playerHand.textContent = '❓';
    dom.aiHand.textContent = '❓';
    dom.resultMsg.textContent = '👋 記憶をリセットしました。';
    updateJankenScore();
    updateHistory();
    updateAcchiScore();
    await syncStatsToServer();
    switchMode(state.currentMode);
}

// ----- 初期化 -----
async function init() {
    await loadAIFromServer();
    loadTheme();
    initDifficultySlider();
    dom.themeToggle.addEventListener('click', toggleTheme);

    dom.jankenButtons.querySelectorAll('.hand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hand = e.currentTarget.dataset.hand;
            if (state.currentMode === 'acchi_only') return;
            if (state.isThinking) return;
            if (state.acchiPhase.active && state.currentMode === 'normal') {
                if (!confirm('あっちむいてホイの途中です。中断しますか？')) return;
                state.acchiPhase.active = false;
                dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
                resetAcchiUI('⏹ 中断されました。');
                enableJankenButtons(true);
                dom.acchiPlayerDir.textContent = '❓';
                dom.acchiAiDir.textContent = '❓';
                dom.acchiResult.textContent = '⏳ 中断されました';
            }
            if (state.acchiPhase.active) {
                state.acchiPhase.active = false;
                dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
                resetAcchiUI('⏹ 中断');
                enableJankenButtons(true);
            }
            handleJankenPlay(hand);
        });
    });

    dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dir = e.currentTarget.dataset.dir;
            if (state.currentMode === 'janken_only') return alert('このモードでは無効です。');
            if (!state.acchiPhase.active) return alert('現在フェーズではありません。');
            if (state.isThinking) return;
            playAcchi(dir);
        });
    });

    dom.modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (!e.target.checked) return;
            if (state.acchiPhase.active) {
                state.acchiPhase.active = false;
                dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
                resetAcchiUI('⏹ モード切替で中断');
                enableJankenButtons(true);
            }
            state.acchiOnlyProcessing = false;
            switchMode(e.target.value);
        });
    });

    dom.resetBtn.addEventListener('click', handleReset);
    switchMode('normal');
    dom.resultMsg.textContent = '👋 手を選んで対戦開始！';
}

document.addEventListener('DOMContentLoaded', init);