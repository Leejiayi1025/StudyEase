import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(request: NextRequest) {
  try {
    const { word, sentence, context } = await request.json();

    if (!word) {
      return NextResponse.json({ error: "请提供要分析的单词" }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的英语词汇分析专家，为英语学习者服务。对给定的单词进行逐词逐句深度分析。

请严格按照以下JSON格式返回，不要添加任何其他文字：
{
  "word": "单词",
  "phonetic": "国际音标",
  "syllables": "音节划分",
  "part_of_speech": "主要词性（可能有多个）",
  "meaning": "中文释义（按词性分类）",
  "root_analysis": "词根词缀分析",
  "word_forms": {
    "noun": "名词形式",
    "verb": "动词形式",
    "adjective": "形容词形式",
    "adverb": "副词形式",
    "past_tense": "过去式",
    "past_participle": "过去分词",
    "comparative": "比较级",
    "superlative": "最高级"
  },
  "grammar_points": ["语法要点1", "语法要点2"],
  "common_collocations": [
    {"phrase": "常用搭配", "meaning": "搭配释义", "example": "例句"}
  ],
  "synonyms": ["同义词1", "同义词2"],
  "antonyms": ["反义词1"],
  "usage_frequency": "高频/中频/低频",
  "memory_tip": "记忆技巧",
  "sentence_analysis": {
    "original": "原句",
    "translation": "逐句翻译",
    "grammar": "句子语法结构分析",
    "key_phrases": [{"phrase": "关键短语", "meaning": "释义"}]
  }
}`;

    const userContent = context
      ? `请分析单词 "${word}"，它在以下语境中出现：${sentence ? `"${sentence}"` : ""}\n\n上下文：${context}`
      : sentence
        ? `请分析单词 "${word}"，它在以下句子中出现："${sentence}"`
        : `请分析单词 "${word}"`;

    const responseContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { temperature: 0.3 }
    );

    let analysis;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      analysis = { word, meaning: responseContent };
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
