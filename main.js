// ============================================================
//  D1を一時的にスキップして動くバージョン
// ============================================================

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

// ----- ヘルパー関数 -----
function getEmoji(hand) {
    const map = { 'グー': '✊', 'チョキ': '✌️', 'パー': '✋' };
    return map[hand] || '❓';
}

function resultToLabel(result) {
    const map = {
        'ai_win': '🤖 AIの勝ち',
        'player_win': '😎 あなたの勝ち',
        'draw': '🤝 引き分け'
    };
    return map[result] || result;
}

function getDirEmoji(dir) {
    const map = { '上': '⬆️', '下': '⬇️', '左': '⬅️', '右': '➡️' };
    return map[dir] || '❓';
}

function getRandomRole() {
    return Math.random() < 0.5 ? 'pointer' : 'mover';
}

function getOppositeRole(role) {
    return role === 'pointer' ? 'mover' : 'pointer';
}

// ----- スコア更新 -----
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
        empty.style.color = '#475569';
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

function resetAcchiUI(message = '👀 じゃんけんで勝敗が決まったら始まります！') {
    dom.acchiStatus.textContent = message;
    dom.acchiPlayerDir.textContent = '❓';
    dom.acchiAiDir.textContent = '❓';
    dom.acchiPlayerRole.textContent = '（役割未定）';
    dom.acchiAiRole.textContent