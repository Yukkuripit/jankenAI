// Cloudflare Pages Functions (D1)

/**
 * GET /api/stats?user_id=xxx
 * → ユーザーの統計データをJSONで返す
 */
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
    }

    const stmt = env.DB.prepare(
        'SELECT janken_stats, acchi_stats FROM user_stats WHERE user_id = ?'
    );
    const result = await stmt.bind(userId).first();

    if (!result) {
        // ユーザー未登録 → 空の統計を返す
        return new Response(JSON.stringify({
            janken_stats: null,
            acchi_stats: null
        }), { status: 200 });
    }

    return new Response(JSON.stringify({
        janken_stats: JSON.parse(result.janken_stats),
        acchi_stats: JSON.parse(result.acchi_stats)
    }), { status: 200 });
}

/**
 * POST /api/stats
 * Body: { user_id, janken_stats, acchi_stats }
 * → ユーザーの統計を upsert
 */
export async function onRequestPost(context) {
    const { request, env } = context;
    const body = await request.json();
    const { user_id, janken_stats, acchi_stats } = body;

    if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
    }

    const jankenJson = JSON.stringify(janken_stats || {});
    const acchiJson = JSON.stringify(acchi_stats || {});
    const now = Date.now();

    const stmt = env.DB.prepare(`
        INSERT INTO user_stats (user_id, janken_stats, acchi_stats, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            janken_stats = excluded.janken_stats,
            acchi_stats = excluded.acchi_stats,
            updated_at = excluded.updated_at
    `);
    await stmt.bind(user_id, jankenJson, acchiJson, now).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
}