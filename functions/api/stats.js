// functions/api/stats.js
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // CORS設定
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // GET: ユーザーデータ取得
    if (request.method === 'GET') {
        const userId = url.searchParams.get('user_id');
        if (!userId) {
            return new Response(JSON.stringify({ error: 'user_id required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const result = await env.DB.prepare(
            'SELECT janken, acchi, total_plays FROM user_stats WHERE user_id = ?'
        ).bind(userId).first();

        if (!result) {
            return new Response(JSON.stringify({
                user_id: userId,
                janken: { counts: {}, transitions: {}, diffCounts: {} },
                acchi: { counts: {}, transitions: {}, diffCounts: {} },
                total_plays: 0
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            user_id: userId,
            janken: JSON.parse(result.janken),
            acchi: JSON.parse(result.acchi),
            total_plays: result.total_plays
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // POST: ユーザーデータ保存
    if (request.method === 'POST') {
        const body = await request.json();
        const { user_id, janken, acchi } = body;

        if (!user_id) {
            return new Response(JSON.stringify({ error: 'user_id required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 既存データ取得
        const existing = await env.DB.prepare(
            'SELECT janken, acchi, total_plays FROM user_stats WHERE user_id = ?'
        ).bind(user_id).first();

        let mergedJanken, mergedAcchi, totalPlays;

        if (existing) {
            const oldJanken = JSON.parse(existing.janken);
            const oldAcchi = JSON.parse(existing.acchi);
            mergedJanken = mergeStats(oldJanken, janken);
            mergedAcchi = mergeStats(oldAcchi, acchi);
            totalPlays = existing.total_plays + (janken.totalPlays || 0) + (acchi.totalPlays || 0);
        } else {
            mergedJanken = janken;
            mergedAcchi = acchi;
            totalPlays = (janken.totalPlays || 0) + (acchi.totalPlays || 0);
        }

        await env.DB.prepare(
            `INSERT INTO user_stats (user_id, janken, acchi, total_plays, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
             janken = ?, acchi = ?, total_plays = ?, updated_at = ?`
        ).bind(
            user_id,
            JSON.stringify(mergedJanken),
            JSON.stringify(mergedAcchi),
            totalPlays,
            Math.floor(Date.now() / 1000),
            JSON.stringify(mergedJanken),
            JSON.stringify(mergedAcchi),
            totalPlays,
            Math.floor(Date.now() / 1000)
        ).run();

        return new Response(JSON.stringify({
            success: true,
            user_id: user_id,
            total_plays: totalPlays
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}

// マージ関数
function mergeStats(oldData, newData) {
    const result = {
        counts: { ...oldData.counts },
        transitions: {},
        diffCounts: { ...oldData.diffCounts }
    };

    for (const [key, val] of Object.entries(newData.counts || {})) {
        result.counts[key] = (result.counts[key] || 0) + val;
    }

    for (const [from, toMap] of Object.entries(newData.transitions || {})) {
        if (!result.transitions[from]) result.transitions[from] = {};
        for (const [to, count] of Object.entries(toMap)) {
            result.transitions[from][to] = (result.transitions[from][to] || 0) + count;
        }
    }

    for (const [diff, count] of Object.entries(newData.diffCounts || {})) {
        result.diffCounts[diff] = (result.diffCounts[diff] || 0) + count;
    }

    return result;
}