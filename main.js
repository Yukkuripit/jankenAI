// ============================================================
//  ファイル: main.js
//  役割: DOM操作・モード切替・クールダウン制御・テーマ切り替え
// ============================================================

// ----- 定数 -----
const COOLDOWN_MS = 1000;

// ----- 状態管理 -----
const state = {
    jankenAI: new JankenAI(),
    acchiAI: new AcchiMuiteAI(),
    currentMode: 'normal',
    jankenStats: {
        playerWins: 0,
        aiWins: 0,
        draws: 0
    },
    acchiStats: {
        playerWins: 0,
        aiWins: 0
    },
    roundResults: [],
    acchiPhase: {
        active: false,
        playerRole: null,
        aiRole: null
    },
    acchiOnlyProcessing: false,
    cooldownEnabled: true,
    isCooldown: false,
    cooldownTimer: null,
    // 🆕 テーマ
    theme: 'light' // 'light' or 'dark'
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
    modeRadios: document.querySelectorAll('input[name="game-mode"]'),
    cooldownToggle: document.getElementById('cooldown-toggle'),
    cooldownStatus: document.getElementById('cooldown-status'),
    // 🆕 テーマボタン
    themeToggle: document.getElementById('theme-toggle')
};

// ----- ヘルパー (じゃんけん) -----
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

// ----- ヘルパー (あっちむいてホイ) -----
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

// ----- 🆕 テーマ切り替え関数 -----
function setTheme(theme) {
    state.theme = theme;
    const body = document.body;
    const toggle = dom.themeToggle;

    if (theme === 'dark') {
        body.classList.add('dark-mode');
        toggle.textContent = '☀️';
    } else {
        body.classList.remove('dark-mode');
        toggle.textContent = '🌙';
    }

    // localStorage に保存
    try {
        localStorage.setItem('janken-theme', theme);
    } catch (e) {
        // 保存できなくても問題なし
    }
}

function toggleTheme() {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function loadTheme() {
    // localStorage から読み込み
    let savedTheme = 'light';
    try {
        const stored = localStorage.getItem('janken-theme');
        if (stored === 'dark' || stored === 'light') {
            savedTheme = stored;
        }
    } catch (e) {
        // 読み込めなくても問題なし
    }

    // システムの設定もチェック（優先度は低め）
    if (!savedTheme) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        savedTheme = prefersDark ? 'dark' : 'light';
    }

    setTheme(savedTheme);
}

// ----- クールダウン制御 -----
function isCoolingDown() {
    if (!state.cooldownEnabled) return false;
    return state.isCooldown;
}

function startCooldown() {
    if (!state.cooldownEnabled) return;
    if (state.cooldownTimer) {
        clearTimeout(state.cooldownTimer);
    }
    state.isCooldown = true;
    state.cooldownTimer = setTimeout(() => {
        state.isCooldown = false;
        state.cooldownTimer = null;
    }, COOLDOWN_MS);
}

function updateCooldownUI() {
    if (state.cooldownEnabled) {
        dom.cooldownStatus.textContent = 'オン';
        dom.cooldownStatus.className = 'cooldown-status on';
    } else {
        dom.cooldownStatus.textContent = 'オフ';
        dom.cooldownStatus.className = 'cooldown-status off';
    }
}

// ----- スコア更新 (じゃんけん) -----
function updateJankenScore() {
    const s = state.jankenStats;
    dom.playerWins.textContent = s.playerWins;
    dom.aiWins.textContent = s.aiWins;
    dom.draws.textContent = s.draws;
    const total = s.playerWins + s.aiWins + s.draws;
    dom.winRate.textContent = total === 0 ? '0%' : `${Math.round((s.aiWins / total) * 100)}%`;
}

// ----- 履歴更新 (じゃんけん) -----
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

// ----- あっちむいてホイ スコア更新 -----
function updateAcchiScore() {
    dom.acchiPlayerScore.textContent = state.acchiStats.playerWins;
    dom.acchiAiScore.textContent = state.acchiStats.aiWins;
}

// ----- あっちむいてホイ UIリセット (待機状態) -----
function resetAcchiUI(message = '👀 じゃんけんで勝敗が決まったら始まります！') {
    dom.acchiStatus.textContent = message;
    dom.acchiPlayerDir.textContent = '❓';
    dom.acchiAiDir.textContent = '❓';
    dom.acchiPlayerRole.textContent = '（役割未定）';
    dom.acchiAiRole.textContent = '（役割未定）';
    dom.acchiResult.textContent = '⏳ 準備中...';
    dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = true);
    state.acchiPhase.active = false;
}

// ----- じゃんけんボタンの有効/無効 -----
function enableJankenButtons(enabled) {
    dom.jankenButtons.querySelectorAll('.hand-btn').forEach(btn => btn.disabled = !enabled);
}

// ----- あっちむいてホイ フェーズ開始 (通常モード用) -----
function startAcchiPhase(jankenResult) {
    if (state.currentMode !== 'normal') return;

    if (jankenResult === 'draw') {
        resetAcchiUI('🤝 引き分け！もう一度じゃんけんをしてください。');
        enableJankenButtons(true);
        return;
    }

    let playerRole, aiRole;
    if (jankenResult === 'player_win') {
        playerRole = 'pointer';
        aiRole = 'mover';
        dom.acchiStatus.textContent = '🎯 あなたの勝ち！ あなたは「指す側」です。';
    } else {
        playerRole = 'mover';
        aiRole = 'pointer';
        dom.acchiStatus.textContent = '🤖 AIの勝ち！ あなたは「動かす側」です。';
    }

    state.acchiPhase.active = true;
    state.acchiPhase.playerRole = playerRole;
    state.acchiPhase.aiRole = aiRole;

    dom.acchiPlayerRole.textContent = playerRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
    dom.acchiAiRole.textContent = aiRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
    dom.acchiResult.textContent = '👉 方向を選んでください！';
    dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = false);
    enableJankenButtons(false);
}

// ----- あっちむいてホイ 連続モード用：ラウンド開始 -----
function startAcchiOnlyRound() {
    if (state.currentMode !== 'acchi_only') return;
    if (state.acchiOnlyProcessing) return;

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

    if (playerRole === 'pointer') {
        dom.acchiStatus.textContent = '🎯 あなたは「指す側」です。AIの動く方向を予想して指してください！';
    } else {
        dom.acchiStatus.textContent = '🙆 あなたは「動かす側」です。AIが指してきた方向を避けてください！';
    }

    dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = false);
}

// ----- あっちむいてホイ プレイ -----
function playAcchi(playerDir) {
    if (!state.acchiPhase.active) {
        alert('現在あっちむいてホイのフェーズではありません。');
        return;
    }
    if (state.currentMode === 'acchi_only' && state.acchiOnlyProcessing) return;

    if (isCoolingDown()) return;
    startCooldown();

    dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = true);

    if (state.currentMode === 'acchi_only') {
        state.acchiOnlyProcessing = true;
    }

    const playerRole = state.acchiPhase.playerRole;
    const aiRole = state.acchiPhase.aiRole;
    const aiDir = state.acchiAI.play(aiRole, playerDir);

    dom.acchiPlayerDir.textContent = getDirEmoji(playerDir);
    dom.acchiAiDir.textContent = getDirEmoji(aiDir);

    let acchiResultMsg = '';
    if (playerRole === 'pointer') {
        if (playerDir === aiDir) {
            acchiResultMsg = '🎉 一致！ あっちむいてホイ あなたの勝ち！';
            state.acchiStats.playerWins++;
        } else {
            acchiResultMsg = '😵 外れた！ あっちむいてホイ AIの勝ち！';
            state.acchiStats.aiWins++;
        }
    } else {
        if (aiDir === playerDir) {
            acchiResultMsg = '💀 一致！ あっちむいてホイ AIの勝ち！';
            state.acchiStats.aiWins++;
        } else {
            acchiResultMsg = '🙌 避けた！ あっちむいてホイ あなたの勝ち！';
            state.acchiStats.playerWins++;
        }
    }

    dom.acchiResult.textContent = acchiResultMsg;
    updateAcchiScore();

    state.acchiPhase.active = false;

    if (state.currentMode === 'normal') {
        dom.acchiStatus.textContent = '✅ あっちむいてホイ終了！ 次のじゃんけんをしてください。';
        enableJankenButtons(true);
        state.acchiOnlyProcessing = false;
    } else if (state.currentMode === 'acchi_only') {
        dom.acchiStatus.textContent = '🔄 次のラウンドの準備ができました！';

        const newPlayerRole = getRandomRole();
        const newAiRole = getOppositeRole(newPlayerRole);
        state.acchiPhase.playerRole = newPlayerRole;
        state.acchiPhase.aiRole = newAiRole;
        state.acchiPhase.active = true;

        dom.acchiPlayerRole.textContent = newPlayerRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
        dom.acchiAiRole.textContent = newAiRole === 'pointer' ? '👉 指す側' : '🙆 動かす側';
        dom.acchiResult.textContent = '👉 次の方向を選んでください！';

        if (newPlayerRole === 'pointer') {
            dom.acchiStatus.textContent = '🎯 あなたは「指す側」です。AIの動く方向を予想して指してください！';
        } else {
            dom.acchiStatus.textContent = '🙆 あなたは「動かす側」です。AIが指してきた方向を避けてください！';
        }

        dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = false);
        state.acchiOnlyProcessing = false;
    }
}

// ----- じゃんけんメイン処理 -----
function handleJankenPlay(playerMove) {
    const result = state.jankenAI.play(playerMove);

    state.roundResults.push({
        player: playerMove,
        ai: result.aiMove,
        result: result.result
    });

    const s = state.jankenStats;
    if (result.result === 'player_win') s.playerWins++;
    else if (result.result === 'ai_win') s.aiWins++;
    else if (result.result === 'draw') s.draws++;

    dom.playerHand.textContent = getEmoji(playerMove);
    dom.aiHand.textContent = getEmoji(result.aiMove);
    dom.resultMsg.textContent = `${resultToLabel(result.result)}`;
    updateJankenScore();
    updateHistory();

    if (state.currentMode === 'janken_only') {
        resetAcchiUI('⏭ じゃんけん連続モード中（あっちむいてホイはスキップ）');
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = true);
        enableJankenButtons(true);
        dom.resultMsg.textContent = '👋 次の手を選んでください！';
    } else if (state.currentMode === 'normal') {
        resetAcchiUI();
        startAcchiPhase(result.result);
    }
}

// ----- モード切り替え処理 -----
function switchMode(mode) {
    state.currentMode = mode;
    state.acchiPhase.active = false;
    state.acchiOnlyProcessing = false;

    dom.jankenArea.classList.remove('game-area-disabled');
    dom.acchiArea.classList.remove('game-area-disabled');

    if (mode === 'normal') {
        enableJankenButtons(true);
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = true);
        resetAcchiUI('👀 じゃんけんで勝敗が決まったら、方向を選びます。');
        dom.resultMsg.textContent = '👋 手を選んで対戦開始！';
        dom.playerHand.textContent = '❓';
        dom.aiHand.textContent = '❓';
    } else if (mode === 'janken_only') {
        dom.acchiArea.classList.add('game-area-disabled');
        enableJankenButtons(true);
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = true);
        resetAcchiUI('⏭ じゃんけん連続モード中（あっちむいてホイはオフ）');
        dom.resultMsg.textContent = '👋 手を選んでじゃんけんを連続で楽しもう！';
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
        dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => btn.disabled = true);
        resetAcchiUI('🔄 あっちむいてホイ連続モード！ 役割がランダムで変わるよ！');
        dom.resultMsg.textContent = '⏸ じゃんけんはスキップ中';
        dom.playerHand.textContent = '⏸';
        dom.aiHand.textContent = '⏸';
        setTimeout(() => {
            if (state.currentMode === 'acchi_only') {
                startAcchiOnlyRound();
            }
        }, 300);
    }

    updateJankenScore();
    updateHistory();
    updateAcchiScore();
}

// ----- リセット処理 -----
function handleReset() {
    if (!confirm('すべての学習データとスコアをリセットします。よろしいですか？')) return;

    if (state.cooldownTimer) {
        clearTimeout(state.cooldownTimer);
        state.cooldownTimer = null;
        state.isCooldown = false;
    }

    state.jankenAI.reset();
    state.acchiAI.reset();
    state.jankenStats = { playerWins: 0, aiWins: 0, draws: 0 };
    state.acchiStats = { playerWins: 0, aiWins: 0 };
    state.roundResults = [];
    state.acchiPhase.active = false;
    state.acchiOnlyProcessing = false;

    dom.playerHand.textContent = '❓';
    dom.aiHand.textContent = '❓';
    dom.resultMsg.textContent = '👋 記憶をリセットしました。';
    updateJankenScore();
    updateHistory();
    updateAcchiScore();

    switchMode(state.currentMode);
}

// ----- 🆕 テーマ切り替えイベント -----
function initThemeToggle() {
    dom.themeToggle.addEventListener('click', toggleTheme);
}

// ----- クールダウン切り替え -----
function initCooldownToggle() {
    dom.cooldownToggle.addEventListener('change', (e) => {
        state.cooldownEnabled = e.target.checked;
        if (!state.cooldownEnabled && state.cooldownTimer) {
            clearTimeout(state.cooldownTimer);
            state.cooldownTimer = null;
            state.isCooldown = false;
        }
        updateCooldownUI();
    });
    updateCooldownUI();
}

// ----- 初期化 -----
function init() {
    // 🆕 テーマ読み込み
    loadTheme();

    // じゃんけんボタン
    dom.jankenButtons.querySelectorAll('.hand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hand = e.currentTarget.dataset.hand;
            if (state.currentMode === 'acchi_only') return;

            if (isCoolingDown()) return;
            startCooldown();

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

    // あっちむいてホイ 方向ボタン
    dom.acchiPad.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dir = e.currentTarget.dataset.dir;
            if (state.currentMode === 'janken_only') {
                alert('このモードではあっちむいてホイは無効です。');
                return;
            }
            if (!state.acchiPhase.active) {
                alert('現在あっちむいてホイのフェーズではありません。');
                return;
            }
            playAcchi(dir);
        });
    });

    // モード切り替え
    dom.modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (state.acchiPhase.active) {
                    state.acchiPhase.active = false;
                    dom.acchiPad.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
                    resetAcchiUI('⏹ モード切替で中断');
                    enableJankenButtons(true);
                }
                state.acchiOnlyProcessing = false;
                switchMode(e.target.value);
            }
        });
    });

    // 🆕 テーマトグル初期化
    initThemeToggle();

    // クールダウントグル初期化
    initCooldownToggle();

    dom.resetBtn.addEventListener('click', handleReset);

    switchMode('normal');
    dom.resultMsg.textContent = '👋 手を選んで対戦開始！';
}

document.addEventListener('DOMContentLoaded', init);