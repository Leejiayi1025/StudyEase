import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { getPool } from "@/storage/database/mysql-client";

export async function POST(request: NextRequest) {
  try {
    const { word, sentence, context, forceAI } = await request.json();

    if (!word) {
      return NextResponse.json({ error: "请提供要分析的单词" }, { status: 400 });
    }

    // 先查本地数据库，有数据就直接返回（除非强制AI分析）
    const pool = getPool();
    let cached: Record<string, unknown> | null = null;
    if (!forceAI) {
      const [rows] = await pool.execute(
        `SELECT * FROM vocabulary WHERE word = ? LIMIT 1`,
        [word.toLowerCase()]
      );
      cached = (rows as Record<string, unknown>[])[0] || null;
    }

    if (cached && cached.meaning) {
      // 本地有数据，组装成分析结果返回（秒回）
      const analysis = {
        word: cached.word,
        phonetic: cached.phonetic || '',
        syllables: '',
        part_of_speech: cached.part_of_speech || '',
        meaning: cached.meaning,
        root_analysis: '',
        word_forms: typeof cached.word_forms === 'string' ? JSON.parse(cached.word_forms as string) : (cached.word_forms || {}),
        grammar_points: [],
        common_collocations: typeof cached.common_phrases === 'string' ? JSON.parse(cached.common_phrases as string) : (cached.common_phrases || []),
        synonyms: [],
        antonyms: '',
        usage_frequency: '',
        memory_tip: '',
        sentence_analysis: cached.example_sentence ? {
          original: cached.example_sentence,
          translation: cached.example_translation || '',
          grammar: '',
          key_phrases: [],
        } : null,
      };
      return NextResponse.json({ success: true, analysis, fromCache: true });
    }

    // 本地没有，调用 AI
    const systemPrompt = `你是英语词汇分析专家。对给定单词做深度分析。严格按JSON格式返回：
{"word":"单词","phonetic":"音标","syllables":"音节","part_of_speech":"词性","meaning":"中文释义","root_analysis":"词根词缀","word_forms":{"noun":"名词","verb":"动词","adjective":"形容词","adverb":"副词","past_tense":"过去式","past_participle":"过去分词","comparative":"比较级","superlative":"最高级"},"grammar_points":["语法要点"],"common_collocations":[{"phrase":"搭配","meaning":"释义","example":"例句"}],"synonyms":["同义词"],"antonyms":["反义词"],"usage_frequency":"高频/中频/低频","memory_tip":"记忆技巧","sentence_analysis":{"original":"原句","translation":"翻译","grammar":"语法分析","key_phrases":[{"phrase":"短语","meaning":"释义"}]}}`;

    const userContent = context
      ? `分析单词"${word}"，语境：${sentence ? `"${sentence}"` : ""} ${context}`
      : sentence
        ? `分析单词"${word}"，句子："${sentence}"`
        : `分析单词"${word}"`;

    const responseContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { temperature: 0.2, maxTokens: 2048 }
    );

    let analysis;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      analysis = { word, meaning: responseContent };
    }

    return NextResponse.json({ success: true, analysis, fromCache: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
