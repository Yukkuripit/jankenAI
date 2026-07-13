// ============================================================
//  ファイル: main.js
//  デバッグ表示なし。alert で動作確認できるようにしてある。
// ============================================================

// ----- ユーティリティ（D1操作用） -----
const API_BASE = '/api/stats';

function getUserId() {
    let userId = localStorage.getItem('janken_user_id');
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('janken_user_id', userId);
    }
    return userId;
}

async function loadStatsFromD1() {
    const userId = getUserId();
    try {
        const res = await fetch(`${API_BASE}?user_id=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function saveStatsToD1(jankenStats, acchiStats) {
    const userId = getUserId();
    try {
        await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, janken_stats: jankenStats, acchi_stats: acchiStats })
        });
    } catch (e) {}
}

// ----- 状態管理 -----
const state = {
    jankenAI: new JankenAI(),
    acchiAI: new AcchiMuiteAI(),
    currentMode: 'normal',
    jankenStats: { playerWins: 0, aiWins: 0, draws: 0 },
    acchiStats: { playerWins: 0, aiWins: 0 },
    roundResults: [],
    acchiPhase: { active: false, playerRole: null, aiRole: null },
    acchiOnlyProcessing: false
};

// ----- DOM参照 -----
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
    modeRadios: document.querySelectorAll('input[name="game-mode"]')
};

// ----- ヘルパー関数（省略、変更なし） -----
function getEmoji(hand) {
    const map = { 'グー': '✊', 'チョキ': '✌️', 'パー': '✋' };
    return map[hand] || '❓';
}
function resultToLabel(result) {
    const map = { 'ai_win': '🤖 AIの勝ち', 'player_win': '😎 あなたの勝ち', 'draw': '🤝 引き分け' };
    return map[result] || result;
}
function getDirEmoji(dir) {
    const map = { '上': '⬆️', '下': '⬇️', '左': '⬅️', '右': '➡️' };
    return map[dir] || '❓';
}
function getRandomRole() { return Math.random() < 0.5 ? 'pointer' : 'mover'; }
function getOppositeRole(role) { return role === 'pointer' ? 'mover' : 'pointer'; }

// ----- スコア更新関数（省略、変更なし） -----
function updateJankenScore() { /* ... 従来通り */ }
function updateHistory() { /* ... 従来通り */ }
function updateAcchiScore() { /* ... 従来通り */ }
function resetAcchiUI(msg) { /* ... 従来通り */ }
function enableJankenButtons(enabled) { /* ... 従来通り */ }

// ----- あっちむいてホイ 関連関数（変更なし） -----
function startAcchiPhase(jankenResult) { /* ... 従来通り */ }
function startAcchiOnlyRound() { /* ... 従来通り */ }
function playAcchi(playerDir) { /* ... 従来通り */ }

// ----- じゃんけんメイン処理（変更なし） -----
function handleJankenPlay(playerMove) { /* ... 従来通り */ }

// ----- モード切り替え（変更なし） -----
function switchMode(mode) { /* ... 従来通り */ }

// ----- リセット（変更なし） -----
function handleReset() { /* ... 従来通り */ }

// ----- 初期化（ここに alert を入れて動作確認） -----
async function init() {
    // 🔽 この alert が出れば main.js は動いている証拠
    alert('✅ main.js が動いています！');

    // D1読み込み
    const stats = await loadStatsFromD1();
    if (stats) {
        state.jankenAI.loadStats(stats.janken_stats);
        state.acchiAI.loadStats(stats.acchi_stats);
    }

    // イベントバインド（従来通り）
    dom.jankenButtons.querySelectorAll('.hand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hand = e.currentTarget.dataset.hand;
            // 🔽 ボタンが押されたことも確認
            alert('✅ ボタンが押されました！手：' + hand);
            handleJankenPlay(hand);
        });
    });

    dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dir = e.currentTarget.dataset.dir;
            // あっちむいてホイの方向ボタン
            if (!state.acchiPhase.active) return;
            playAcchi(dir);
        });
    });

    dom.modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) switchMode(e.target.value);
        });
    });

    dom.resetBtn.addEventListener('click', handleReset);

    // 初期表示
    switchMode('normal');
    updateJankenScore();
    updateHistory();
    updateAcchiScore();
    dom.resultMsg.textContent = '👋 手を選んで対戦開始！';

    // ページ離脱時に保存
    window.addEventListener('beforeunload', () => {
        saveStatsToD1(state.jankenAI.exportStats(), state.acchiAI.exportStats());
    });
}

document.addEventListener('DOMContentLoaded', init);