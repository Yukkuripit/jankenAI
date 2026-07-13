// ============================================================
//  ファイル: main.js
//  役割: D1と連携して統計データを読み書きする
// ============================================================

// ----- D1操作用ユーティリティ -----
const API_BASE = '/api/stats';

// ユーザーIDを取得（LocalStorageに保存）
function getUserId() {
    let userId = localStorage.getItem('janken_user_id');
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('janken_user_id', userId);
    }
    return userId;
}

// D1から統計を読み込む
async function loadStatsFromD1() {
    const userId = getUserId();
    try {
        const res = await fetch(`${API_BASE}?user_id=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        return data;
    } catch (e) {
        console.warn('D1 load failed:', e);
        return null;
    }
}

// D1に統計を保存する
async function saveStatsToD1(jankenStats, acchiStats) {
    const userId = getUserId();
    try {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                janken_stats: jankenStats,
                acchi_stats: acchiStats
            })
        });
        if (!res.ok) throw new Error('Failed to save stats');
        return true;
    } catch (e) {
        console.warn('D1 save failed:', e);
        return false;
    }
}

// ----- 既存の状態管理 -----
const state = {
    jankenAI: new JankenAI(),
    acchiAI: new AcchiMuiteAI(),
    // ... その他既存のstate
};

// ----- 初期化時にD1から読み込む -----
async function init() {
    // D1から統計を取得
    const stats = await loadStatsFromD1();
    if (stats) {
        state.jankenAI.loadStats(stats.janken_stats);
        state.acchiAI.loadStats(stats.acchi_stats);
        console.log('✅ D1から統計を読み込みました');
    } else {
        console.log('📭 D1に統計データはありません（新規ユーザー）');
    }

    // ---- 既存のDOMイベントバインドなど ----
    // ... （ここにこれまでのmain.jsの内容を全てコピー）

    // ---- ページ離脱時に保存 ----
    window.addEventListener('beforeunload', () => {
        const jankenStats = state.jankenAI.exportStats();
        const acchiStats = state.acchiAI.exportStats();
        saveStatsToD1(jankenStats, acchiStats);
    });

    // ---- 任意のタイミングで保存（例：10回プレイごと） ----
    let playCount = 0;
    const originalHandleJankenPlay = handleJankenPlay;
    handleJankenPlay = function(playerMove) {
        originalHandleJankenPlay(playerMove);
        playCount++;
        if (playCount % 10 === 0) {
            const jankenStats = state.jankenAI.exportStats();
            const acchiStats = state.acchiAI.exportStats();
            saveStatsToD1(jankenStats, acchiStats);
        }
    };
}