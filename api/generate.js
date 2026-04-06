// api/generate.js — Vercel Serverless Function
// 文案引擎：通义千问 DashScope 直连
// 图片引擎：OpenRouter → Gemini（付费功能）

const QWEN_KEY = process.env.QWEN_API_KEY     || 'sk-cfb5319ee5a24f7b9361608b7615a79b';
const OR_KEY   = process.env.OPENROUTER_API_KEY || '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';

const QWEN_SYSTEM = `你是一位拥有10年经验的中国顶尖电商操盘手，深度精通抖音、小红书、朋友圈的内容营销规律。

【小红书种草风格】必须大量使用表情符号（🌸✨💫🔥👏💕），语气亲切（家人们/绝绝子/亲测好用），排版有呼吸感每段不超3行，重点词用【】标注，结尾5-8个热门标签，200-350字。

【抖音爆款脚本】黄金3秒：①反转 ②冲突 ③利益点 三选一开头。节奏紧凑口播感强，不超3个核心卖点，结尾强力转化。格式：[开场] [展示] [卖点] [转化] 分镜输出。

【朋友圈文案】80-150字，情感共鸣优先，软植入，结尾强力金句。不用hashtag。

直接输出文案，不要任何前缀说明，质量对标头部MCN机构。`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { product, selling, style, preset } = req.body || {};
  if (!product) return res.status(400).json({ error: '请输入产品名称' });

  const styleMap  = { xhs:'小红书种草风格', douyin:'抖音爆款脚本', wechat:'朋友圈文案' };
  const presetMap = {
    c4d:     'C4D工业风（金属质感、高饱和、冷色调）',
    guochao: '国潮3D（东方美学、暖色、传统纹样）',
    minimal: '极简摄影（大留白、低饱和、轻奢感）',
  };

  const userMsg = `产品名称：${product}
核心卖点：${selling || '高品质、极致性价比'}
目标风格：${styleMap[style] || styleMap.xhs}
视觉参考：${presetMap[preset] || presetMap.c4d}
目标人群：18-35岁都市用户，有一定消费力`;

  // ── 1st choice：千问 DashScope 直连 ─────────────────────
  try {
    const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${QWEN_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-max',
        input: { messages: [{ role:'system', content:QWEN_SYSTEM }, { role:'user', content:userMsg }] },
        parameters: { result_format:'message', max_tokens:1200, temperature:0.88, top_p:0.95 },
      }),
    });

    if (r.ok) {
      const d = await r.json();
      const text = d?.output?.choices?.[0]?.message?.content;
      if (text) {
        return res.status(200).json({ content: text, engine: 'qwen-dashscope' });
      }
    }
    const errBody = await r.text().catch(()=>'');
    console.warn('DashScope non-ok:', r.status, errBody);
  } catch (e) {
    console.warn('DashScope fetch error:', e.message);
  }

  // ── 2nd choice（降级）：OpenRouter → qwen-max ──────────
  try {
    const r2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trafficmaster.vercel.app',
        'X-Title': 'TrafficMaster AI',
      },
      body: JSON.stringify({
        model: 'qwen/qwen-max',
        messages: [{ role:'system', content:QWEN_SYSTEM }, { role:'user', content:userMsg }],
        max_tokens: 1200, temperature: 0.88,
      }),
    });
    const d2 = await r2.json();
    const text2 = d2?.choices?.[0]?.message?.content;
    if (text2) {
      return res.status(200).json({ content: text2, engine: 'openrouter-qwen-fallback' });
    }
    return res.status(502).json({ error: '两个引擎均无响应，请稍后重试' });
  } catch (e2) {
    return res.status(500).json({ error: e2.message || '服务暂时不可用' });
  }
};
