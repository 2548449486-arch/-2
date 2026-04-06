// api/generate.js — Vercel Serverless Function
// API key lives ONLY here, never exposed to frontend

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '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';

const QWEN_SYSTEM_PROMPT = `你是一位拥有10年经验的中国顶尖电商操盘手，深度精通抖音、小红书、朋友圈的内容营销规律。

【小红书种草风格】
必须大量使用表情符号（🌸✨💫🔥👏💕），语气亲切自然，常用"家人们""绝绝子""亲测好用""超级无敌"。排版要有呼吸感：每段不超过3行，多用换行和空白，重点词用【】框起来。结尾必须带5-8个热门标签（#好物推荐 #种草清单 #测评 等）。字数控制在200-350字。

【抖音爆款脚本】
黄金3秒开头必须用以下之一：①反转（你以为…其实…）②冲突（为什么...）③利益点（看完这条...）。节奏紧凑，每5-8字换一节奏点，口播感强。中间植入不超过3个核心卖点，每个一句话。结尾强力引导：点赞收藏、限时福利。格式用分镜：[开场/冲突] [展示] [卖点] [转化] 分开写。

【朋友圈文案】
字数80-150字，精简有力。情感共鸣优先，软植入产品。结尾一个强力金句或问句引导互动。不用hashtag。

请按指定风格输出，质量对标头部MCN机构水准。不要输出任何说明或前缀，直接给文案。`;

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, selling, style, preset } = req.body || {};

  if (!product) {
    return res.status(400).json({ error: '请输入产品名称' });
  }

  const styleMap = {
    xhs: '小红书种草风格',
    douyin: '抖音爆款脚本',
    wechat: '朋友圈文案'
  };
  const presetMap = {
    c4d: 'C4D工业风（金属质感、高饱和、冷色调）',
    guochao: '国潮3D（东方美学、暖色、传统纹样）',
    minimal: '极简摄影（大留白、低饱和、轻奢感）'
  };

  const userMessage = `产品名称：${product}
核心卖点：${selling || '高品质、极致性价比'}
目标风格：${styleMap[style] || styleMap.xhs}
视觉参考：${presetMap[preset] || presetMap.c4d}
目标平台用户：18-35岁都市女性/男性，有一定消费力`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://trafficmaster.vercel.app',
        'X-Title': 'TrafficMaster AI 流量大师',
      },
      body: JSON.stringify({
        model: 'qwen/qwen-max',
        messages: [
          { role: 'system', content: QWEN_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1200,
        temperature: 0.88,
        top_p: 0.95,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', response.status, errText);
      return res.status(502).json({ error: `上游服务错误 ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({ error: error.message || '服务器内部错误' });
  }
};