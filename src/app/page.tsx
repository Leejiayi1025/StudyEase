'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  Upload,
  Library,
  Brain,
  AlertTriangle,
  ChevronRight,
  Search,
  Star,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  FileText,
  Image as ImageIcon,
  Type,
  ArrowLeft,
  Play,
  Trophy,
  Target,
  Sparkles,
  BookMarked,
  RefreshCw,
} from 'lucide-react';

// Types
interface VocabWord {
  id: string;
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  meaning: string;
  example_sentence: string | null;
  example_translation: string | null;
  common_phrases: Array<{ phrase: string; meaning: string }> | null;
  word_forms: Record<string, string> | null;
  mastery_level: number;
  is_cet4_core: boolean;
  review_count: number;
  correct_count: number;
  difficulty: string | null;
}

interface MistakeItem {
  id: string;
  word: string;
  mistake_type: string;
  user_answer: string | null;
  correct_answer: string | null;
  is_resolved: boolean;
  review_count: number;
  created_at: string;
}

interface QuizQuestion {
  id: number;
  word: string;
  type: string;
  question: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
}

interface AnalysisData {
  word: string;
  phonetic: string;
  syllables: string;
  part_of_speech: string;
  meaning: string;
  root_analysis: string;
  word_forms: Record<string, string>;
  grammar_points: string[];
  common_collocations: Array<{ phrase: string; meaning: string; example: string }>;
  synonyms: string[];
  antonyms: string[];
  usage_frequency: string;
  memory_tip: string;
  sentence_analysis: {
    original: string;
    translation: string;
    grammar: string;
    key_phrases: Array<{ phrase: string; meaning: string }>;
  } | null;
}

type TabType = 'home' | 'import' | 'questions' | 'vocabulary' | 'quiz' | 'mistakes';

// Clickable text helper - wraps English words in clickable spans
function ClickableText({ text, onWordClick }: { text: string; onWordClick: (word: string) => void }) {
  if (!text) return <>{text}</>;
  const parts = text.split(/([a-zA-Z]{2,})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^[a-zA-Z]{2,}$/.test(part)) {
          return (
            <span
              key={i}
              className="cursor-pointer text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid transition-colors"
              onClick={(e) => { e.stopPropagation(); onWordClick(part.toLowerCase()); }}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Main App Component
export default function StudyApp() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [stats, setStats] = useState({
    totalWords: 0, masteredWords: 0, learningWords: 0, unresolvedMistakes: 0,
  });
  const [popupWord, setPopupWord] = useState<string | null>(null);

  const handleWordClick = useCallback((word: string) => {
    setPopupWord(word);
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/progress');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <h1 className="font-bold text-lg tracking-tight">StudyEase</h1>
          <span className="text-[10px] opacity-60 font-normal">by Lee</span>
        </div>
        <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30">
          <Sparkles className="w-3 h-3 mr-1" />
          AI 智能学习
        </Badge>
      </header>

      {/* Word Popup */}
      {popupWord && (
        <WordPopup word={popupWord} open={!!popupWord} onClose={() => setPopupWord(null)} />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && <HomePage stats={stats} onNavigate={setActiveTab} />}
        {activeTab === 'import' && <ImportPage onDone={fetchProgress} onWordClick={handleWordClick} />}
        {activeTab === 'questions' && <QuestionBankPage />}
        {activeTab === 'vocabulary' && <VocabularyPage onWordClick={handleWordClick} />}
        {activeTab === 'quiz' && <QuizPage onWordClick={handleWordClick} />}
        {activeTab === 'mistakes' && <MistakesPage />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border max-w-lg mx-auto">
        <div className="flex justify-around py-1">
          {[
            { key: 'home' as TabType, icon: Target, label: '首页' },
            { key: 'import' as TabType, icon: Upload, label: '导入' },
            { key: 'questions' as TabType, icon: BookMarked, label: '题库' },
            { key: 'vocabulary' as TabType, icon: Library, label: '词库' },
            { key: 'quiz' as TabType, icon: Brain, label: '测试' },
            { key: 'mistakes' as TabType, icon: AlertTriangle, label: '错题本' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-col items-center py-1.5 px-3 rounded-lg transition-colors ${
                activeTab === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeTab === key ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ===== HOME PAGE =====
function HomePage({ stats, onNavigate }: { stats: { totalWords: number; masteredWords: number; learningWords: number; unresolvedMistakes: number }; onNavigate: (tab: TabType) => void }) {
  const masteryPercent = stats.totalWords > 0 ? Math.round((stats.masteredWords / stats.totalWords) * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Progress Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            今日学习进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                  className="text-primary transition-all duration-1000"
                  strokeDasharray={`${masteryPercent * 2.14} 214`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary">
                {masteryPercent}%
              </span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已掌握</span>
                <span className="font-medium text-primary">{stats.masteredWords}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">学习中</span>
                <span className="font-medium">{stats.learningWords}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">待复习错题</span>
                <span className="font-medium text-destructive">{stats.unresolvedMistakes}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => onNavigate('import')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">导入材料</p>
              <p className="text-[11px] text-muted-foreground">AI智能提取分析</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => onNavigate('questions')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-1/10 flex items-center justify-center">
              <BookMarked className="w-5 h-5 text-chart-1" />
            </div>
            <div>
              <p className="font-medium text-sm">题库刷题</p>
              <p className="text-[11px] text-muted-foreground">导入题目多次练习</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => onNavigate('vocabulary')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <Library className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <p className="font-medium text-sm">词库</p>
              <p className="text-[11px] text-muted-foreground">{stats.totalWords} 个词汇</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => onNavigate('mistakes')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-sm">错题本</p>
              <p className="text-[11px] text-muted-foreground">{stats.unresolvedMistakes} 题待复习</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Study Tips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-chart-4" />
            学习建议
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span>导入英语文章，AI自动提取题目和重点词汇</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span>在题库中反复刷题，巩固薄弱知识点</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span>点击任意单词查看详细解析和举一反三练习</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span>错题要当天复习，连续答对3次才算掌握</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== IMPORT PAGE =====
function ImportPage({ onDone, onWordClick }: { onDone: () => void; onWordClick: (word: string) => void }) {
  const [importType, setImportType] = useState<'text' | 'image'>('text');
  const [textContent, setTextContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleImport = async () => {
    if (!textContent.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textContent, sourceType: importType, title: title || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.analysis as Record<string, unknown>);
        onDone();
      } else {
        setResult({ error: data.error });
      }
    } catch {
      setResult({ error: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error);

      // For image, we use LLM to OCR and analyze
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `[用户上传了图片，URL: ${uploadData.url}]\n请识别图片中的英文文本并分析提取题目和词汇。`,
          sourceType: 'image',
          title: file.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.analysis as Record<string, unknown>);
        onDone();
      } else {
        setResult({ error: data.error });
      }
    } catch {
      setResult({ error: '上传失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const hasResult = result !== null;
  const hasError: boolean = hasResult && 'error' in result && Boolean(result.error);
  const hasQuestions: boolean = hasResult && 'questions' in result;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">导入学习材料</h2>
      <p className="text-sm text-muted-foreground">粘贴英语文章或上传图片，AI自动提取题目、重点词汇和逐词分析</p>

      {/* Type Selector */}
      <div className="flex gap-2">
        <Button
          variant={importType === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setImportType('text')}
          className="flex-1"
        >
          <Type className="w-4 h-4 mr-1" />
          粘贴文本
        </Button>
        <Button
          variant={importType === 'image' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setImportType('image')}
          className="flex-1"
        >
          <ImageIcon className="w-4 h-4 mr-1" />
          上传图片
        </Button>
      </div>

      {importType === 'text' ? (
        <div className="space-y-3">
          <Input
            placeholder="标题（可选）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="粘贴英语文章、阅读理解、完形填空等内容..."
            className="min-h-[200px] text-sm"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
          />
          <Button onClick={handleImport} disabled={loading || !textContent.trim()} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? 'AI分析中...' : '智能提取分析'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="image-upload" />
            <label htmlFor="image-upload" className="cursor-pointer">
              <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">点击上传图片</p>
              <p className="text-xs text-muted-foreground mt-1">支持 JPG、PNG、WebP</p>
            </label>
          </div>
          {loading && (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">AI正在识别和分析...</p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasResult && !hasError && hasQuestions && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              分析完成
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                提取 {Array.isArray(result.questions) ? result.questions.length : 0} 道题
              </span>
              <span className="flex items-center gap-1">
                <BookMarked className="w-3 h-3" />
                发现 {Array.isArray(result.key_vocabulary) ? result.key_vocabulary.length : 0} 个重点词汇
              </span>
            </div>
            {Array.isArray(result.key_vocabulary) && (result.key_vocabulary as Array<{ word: string; meaning: string }>).slice(0, 5).map((v, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <span
                  className="font-medium text-sm cursor-pointer text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  onClick={() => onWordClick(v.word)}
                >{v.word}</span>
                <span className="text-xs text-muted-foreground">{v.meaning}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasError && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-destructive text-sm">{String(result?.error)}</CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== WORD POPUP =====
function WordPopup({ word, open, onClose }: { word: string; open: boolean; onClose: () => void }) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if (!open || !word) return;
    setAnalysis(null);
    setQuizQuestions([]);
    setShowQuiz(false);
    setSelectedAnswer(null);
    setShowExplanation(false);

    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        // Try local vocab first
        const vocabRes = await fetch(`/api/vocabulary?search=${encodeURIComponent(word)}&pageSize=1`);
        const vocabData = await vocabRes.json();
        if (vocabData.data?.length > 0) {
          const w = vocabData.data[0];
          setAnalysis({
            word: w.word,
            phonetic: w.phonetic || '',
            syllables: '',
            part_of_speech: w.part_of_speech || '',
            meaning: w.meaning,
            root_analysis: '',
            word_forms: w.word_forms || {},
            grammar_points: [],
            common_collocations: w.common_phrases || [],
            synonyms: [],
            antonyms: [],
            usage_frequency: '',
            memory_tip: '',
            sentence_analysis: w.example_sentence ? {
              original: w.example_sentence,
              translation: w.example_translation || '',
              grammar: '',
              key_phrases: [],
            } : null,
          });
        }
        // Always fetch AI analysis for richer data
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word }),
        });
        const data = await res.json();
        if (data.success && data.analysis) {
          setAnalysis(data.analysis);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchAnalysis();
  }, [word, open]);

  const generateQuiz = async () => {
    setQuizLoading(true);
    setShowQuiz(true);
    setSelectedAnswer(null);
    setShowExplanation(false);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: [word], quizType: 'meaning', count: 3 }),
      });
      const data = await res.json();
      if (data.success && data.quiz.questions?.length > 0) {
        setQuizQuestions(data.quiz.questions);
      }
    } catch { /* ignore */ }
    setQuizLoading(false);
  };

  const handleQuizAnswer = (answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    setShowExplanation(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono">{word}</span>
            {analysis?.phonetic && <span className="text-sm text-muted-foreground font-normal">{analysis.phonetic}</span>}
          </DialogTitle>
        </DialogHeader>

        {loading && !analysis ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Part of Speech & Meaning */}
            <div className="space-y-2">
              {analysis.part_of_speech && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.part_of_speech.split(/[,、]/).map((pos, i) => (
                    <Badge key={i} variant="secondary">{pos.trim()}</Badge>
                  ))}
                </div>
              )}
              <p className="text-sm leading-relaxed">{analysis.meaning}</p>
            </div>

            {/* Word Forms */}
            {analysis.word_forms && Object.keys(analysis.word_forms).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                  词形变化
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(analysis.word_forms).filter(([, v]) => v).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-xs py-1 px-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common Collocations */}
            {analysis.common_collocations && analysis.common_collocations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <BookMarked className="w-3.5 h-3.5 text-primary" />
                  常见短语搭配
                </h4>
                <div className="space-y-2">
                  {analysis.common_collocations.map((col, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/30 rounded">
                      <span className="font-medium">{col.phrase}</span>
                      <span className="text-muted-foreground ml-2">{col.meaning}</span>
                      {'example' in col && (col as { example?: string }).example && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{(col as { example: string }).example}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Example Sentence */}
            {analysis.sentence_analysis && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  例句
                </h4>
                <div className="p-3 bg-muted/30 rounded space-y-1">
                  <p className="text-sm font-mono">{analysis.sentence_analysis.original}</p>
                  <p className="text-xs text-muted-foreground">{analysis.sentence_analysis.translation}</p>
                </div>
              </div>
            )}

            {/* Synonyms & Antonyms */}
            {(analysis.synonyms?.length > 0 || analysis.antonyms?.length > 0) && (
              <div className="flex flex-wrap gap-3">
                {analysis.synonyms?.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground mr-1.5">同义:</span>
                    {analysis.synonyms.map((s, i) => (
                      <Badge key={i} variant="secondary" className="mr-1 mb-1 text-xs">{s}</Badge>
                    ))}
                  </div>
                )}
                {analysis.antonyms?.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground mr-1.5">反义:</span>
                    {analysis.antonyms.map((a, i) => (
                      <Badge key={i} variant="outline" className="mr-1 mb-1 text-xs">{a}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Memory Tip */}
            {analysis.memory_tip && (
              <div className="p-3 bg-chart-4/5 border border-chart-4/20 rounded">
                <p className="text-xs"><span className="font-medium">记忆技巧: </span>{analysis.memory_tip}</p>
              </div>
            )}

            {/* Generate Quiz Button */}
            {!showQuiz && (
              <Button variant="outline" className="w-full" onClick={generateQuiz}>
                <Brain className="w-4 h-4 mr-2" />
                举一反三 · 生成练习题
              </Button>
            )}

            {/* Quiz Section */}
            {showQuiz && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  举一反三练习
                </h4>
                {quizLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-1">生成中...</p>
                  </div>
                ) : quizQuestions.length > 0 ? (
                  quizQuestions.map((q, qi) => (
                    <Card key={qi} className="border-primary/10">
                      <CardContent className="p-3 space-y-2">
                        <p className="text-sm font-medium">{q.question}</p>
                        <div className="space-y-1.5">
                          {Object.entries(q.options).map(([key, value]) => {
                            const isSelected = selectedAnswer === key && qi === quizQuestions.length - 1;
                            const isCorrect = key === q.correct_answer && qi === quizQuestions.length - 1;
                            let cls = 'border-border hover:border-primary/50 cursor-pointer';
                            if (qi === quizQuestions.length - 1 && selectedAnswer) {
                              if (isCorrect) cls = 'border-primary bg-primary/5';
                              else if (isSelected) cls = 'border-destructive bg-destructive/5';
                            }
                            return (
                              <div
                                key={key}
                                className={`flex items-center gap-2 p-2 rounded border text-xs transition-colors ${cls}`}
                                onClick={() => qi === quizQuestions.length - 1 && handleQuizAnswer(key)}
                              >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  qi === quizQuestions.length - 1 && selectedAnswer && isCorrect ? 'bg-primary text-primary-foreground' :
                                  qi === quizQuestions.length - 1 && selectedAnswer && isSelected ? 'bg-destructive text-destructive-foreground' :
                                  'bg-muted text-muted-foreground'
                                }`}>{key}</span>
                                <span>{value}</span>
                              </div>
                            );
                          })}
                        </div>
                        {qi === quizQuestions.length - 1 && showExplanation && (
                          <div className="text-xs text-muted-foreground p-2 bg-primary/5 rounded">
                            {selectedAnswer === q.correct_answer ? '✓ 正确！' : '✗ 错误'} {q.explanation}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">暂无练习题</p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ===== QUESTION BANK PAGE =====
function QuestionBankPage() {
  const [questions, setQuestions] = useState<Array<{
    id: string;
    question_text: string;
    options: Record<string, string>;
    correct_answer: string;
    explanation: string;
    question_type: string;
    material_id: string;
    study_materials?: { title?: string } | null;
  }>>([]);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<typeof questions>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizResults, setQuizResults] = useState<Array<{ correct: boolean; questionId: string }>>([]);
  const pageSize = 20;

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter !== 'all') params.set('type', filter);
      const res = await fetch(`/api/questions?${params}`);
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data || []);
        setTotal(data.total || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const startQuiz = () => {
    if (questions.length === 0) return;
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, Math.min(10, questions.length));
    setQuizQuestions(shuffled);
    setQuizMode(true);
    setQuizIndex(0);
    setQuizResults([]);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  const handleQuizAnswer = async (answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    setShowExplanation(true);
    const q = quizQuestions[quizIndex];
    const isCorrect = answer === q.correct_answer;
    setQuizResults(prev => [...prev, { correct: isCorrect, questionId: q.id }]);

    if (!isCorrect) {
      try {
        await fetch('/api/mistakes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: q.question_text.slice(0, 50),
            mistake_type: q.question_type || 'meaning',
            user_answer: answer,
            correct_answer: q.correct_answer,
            question_id: q.id,
          }),
        });
      } catch { /* ignore */ }
    }
  };

  const nextQuizQuestion = () => {
    if (quizIndex + 1 >= quizQuestions.length) {
      // Quiz finished
    } else {
      setQuizIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = { reading: '阅读', vocabulary: '词汇', grammar: '语法' };
    return labels[type] || type;
  };

  const getQuestionTypeColor = (type: string) => {
    const colors: Record<string, string> = { reading: 'bg-chart-1/10 text-chart-1', vocabulary: 'bg-chart-2/10 text-chart-2', grammar: 'bg-chart-4/10 text-chart-4' };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  // Quiz result view
  if (quizMode && quizIndex >= quizQuestions.length) {
    const correctCount = quizResults.filter(r => r.correct).length;
    const accuracy = quizResults.length > 0 ? Math.round((correctCount / quizResults.length) * 100) : 0;
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setQuizMode(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回题库
          </Button>
        </div>
        <h2 className="text-lg font-bold">刷题结果</h2>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-primary">{accuracy}%</div>
            <p className="text-sm text-muted-foreground mt-1">正确率</p>
            <div className="flex justify-center gap-6 mt-4">
              <div>
                <p className="text-2xl font-bold text-primary">{correctCount}</p>
                <p className="text-xs text-muted-foreground">正确</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{quizResults.length - correctCount}</p>
                <p className="text-xs text-muted-foreground">错误</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setQuizMode(false)} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回题库
          </Button>
          <Button onClick={startQuiz} className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />
            再来一轮
          </Button>
        </div>
      </div>
    );
  }

  // Quiz in progress
  if (quizMode && quizQuestions[quizIndex]) {
    const q = quizQuestions[quizIndex];
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setQuizMode(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            退出
          </Button>
          <span className="text-sm text-muted-foreground">{quizIndex + 1}/{quizQuestions.length}</span>
          <Progress value={((quizIndex + 1) / quizQuestions.length) * 100} className="flex-1" />
        </div>

        <Card>
          <CardContent className="p-5">
            <Badge variant="secondary" className="mb-3">{getQuestionTypeLabel(q.question_type)}</Badge>
            <p className="text-base font-medium">{q.question_text}</p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {Object.entries(q.options as Record<string, string>).map(([key, value]) => {
            const isSelected = selectedAnswer === key;
            const isCorrect = key === q.correct_answer;
            let optionClass = 'border-border hover:border-primary/50';
            if (selectedAnswer) {
              if (isCorrect) optionClass = 'border-primary bg-primary/5';
              else if (isSelected) optionClass = 'border-destructive bg-destructive/5';
            }
            return (
              <Card
                key={key}
                className={`cursor-pointer transition-all ${optionClass} ${!selectedAnswer ? 'active:scale-[0.99]' : ''}`}
                onClick={() => !selectedAnswer && handleQuizAnswer(key)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedAnswer && isCorrect ? 'bg-primary text-primary-foreground' :
                    selectedAnswer && isSelected ? 'bg-destructive text-destructive-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {selectedAnswer && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                     selectedAnswer && isSelected ? <XCircle className="w-4 h-4" /> : key}
                  </span>
                  <span className="text-sm">{value}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {showExplanation && (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm">
                <p className="font-medium mb-1">{selectedAnswer === q.correct_answer ? '回答正确!' : '回答错误'}</p>
                <p className="text-muted-foreground">{q.explanation}</p>
              </CardContent>
            </Card>
            <Button onClick={nextQuizQuestion} className="w-full">
              {quizIndex + 1 >= quizQuestions.length ? '查看结果' : '下一题'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}
      </div>
    );
  }

  // Question bank list view
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">题库</h2>
        <Button size="sm" onClick={startQuiz} disabled={questions.length === 0}>
          <Play className="w-4 h-4 mr-1" />
          开始刷题
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1 text-xs">全部</TabsTrigger>
          <TabsTrigger value="reading" className="flex-1 text-xs">阅读</TabsTrigger>
          <TabsTrigger value="vocabulary" className="flex-1 text-xs">词汇</TabsTrigger>
          <TabsTrigger value="grammar" className="flex-1 text-xs">语法</TabsTrigger>
        </TabsList>
      </Tabs>

      <p className="text-xs text-muted-foreground">共 {total} 道题</p>

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BookMarked className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">题库为空，请先导入学习材料</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => {
              const event = new CustomEvent('navigate', { detail: 'import' });
              window.dispatchEvent(event);
            }}>
              <Upload className="w-4 h-4 mr-1" />
              去导入
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <Card
                key={q.id}
                className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]"
                onClick={() => setSelectedQuestion(selectedQuestion === i ? null : i)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getQuestionTypeColor(q.question_type)} variant="secondary">
                          {getQuestionTypeLabel(q.question_type)}
                        </Badge>
                        {q.study_materials?.title && (
                          <span className="text-[10px] text-muted-foreground truncate">{q.study_materials.title}</span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">{q.question_text}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${selectedQuestion === i ? 'rotate-90' : ''}`} />
                  </div>

                  {selectedQuestion === i && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      {Object.entries(q.options as Record<string, string>).map(([key, value]) => (
                        <div key={key} className={`flex items-center gap-2 text-sm p-2 rounded ${
                          key === q.correct_answer ? 'bg-primary/5 text-primary' : ''
                        }`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            key === q.correct_answer ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>{key}</span>
                          <span>{value}</span>
                          {key === q.correct_answer && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto" />}
                        </div>
                      ))}
                      {q.explanation && (
                        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                          <span className="font-medium">解析: </span>{q.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {total > pageSize && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                {page}/{Math.ceil(total / pageSize)}
              </span>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(page + 1)}>
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== VOCABULARY PAGE =====
function VocabularyPage({ onWordClick }: { onWordClick: (word: string) => void }) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [selectedWord, setSelectedWord] = useState<VocabWord | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  const fetchWords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter !== 'all') params.set('mastery', filter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/vocabulary?${params}`);
      const data = await res.json();
      if (data.success) {
        setWords(data.data || []);
        setTotal(data.total || 0);
      }
    } catch { /* ignore */ }
  }, [page, filter, search]);

  useEffect(() => { fetchWords(); }, [fetchWords]);

  const analyzeWord = async (word: VocabWord) => {
    setSelectedWord(word);
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.word }),
      });
      const data = await res.json();
      if (data.success) setAnalysis(data.analysis);
    } catch { /* ignore */ }
    setAnalyzing(false);
  };

  const getMasteryLabel = (level: number) => {
    return ['', '认识', '学习中', '已掌握'][level] || '未学';
  };
  const getMasteryColor = (level: number) => {
    return ['', 'bg-muted text-muted-foreground', 'bg-chart-4/20 text-chart-4', 'bg-primary/20 text-primary'][level] || 'bg-muted text-muted-foreground';
  };

  if (selectedWord) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedWord(null); setAnalysis(null); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
        </div>

        {/* Word Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold font-mono">{selectedWord.word}</h2>
              {selectedWord.phonetic && <span className="text-sm text-muted-foreground">{selectedWord.phonetic}</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {selectedWord.part_of_speech && <Badge variant="secondary">{selectedWord.part_of_speech}</Badge>}
              <Badge className={getMasteryColor(selectedWord.mastery_level)}>
                {getMasteryLabel(selectedWord.mastery_level)}
              </Badge>
            </div>
            <p className="mt-2 text-sm">{selectedWord.meaning}</p>
          </CardContent>
        </Card>

        {/* AI Analysis */}
        {analyzing ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">AI深度分析中...</p>
            </CardContent>
          </Card>
        ) : analysis ? (
          <div className="space-y-3">
            {/* Root Analysis */}
            {analysis.root_analysis && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="w-3 h-3 text-chart-4" />
                    词根词缀
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{analysis.root_analysis}</CardContent>
              </Card>
            )}

            {/* Word Forms */}
            {analysis.word_forms && Object.keys(analysis.word_forms).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">词形变化</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(analysis.word_forms).filter(([, v]) => v).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grammar Points */}
            {analysis.grammar_points?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">语法要点</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {analysis.grammar_points.map((point, i) => (
                    <p key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      {point}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Common Collocations */}
            {analysis.common_collocations?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">常用搭配</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.common_collocations.map((col, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{col.phrase}</span>
                      <span className="text-muted-foreground ml-2">{col.meaning}</span>
                      {col.example && <p className="text-xs text-muted-foreground mt-0.5 italic">{col.example}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Synonyms & Antonyms */}
            {(analysis.synonyms?.length > 0 || analysis.antonyms?.length > 0) && (
              <Card>
                <CardContent className="p-4">
                  {analysis.synonyms?.length > 0 && (
                    <div className="text-sm mb-2">
                      <span className="text-muted-foreground mr-2">同义:</span>
                      {analysis.synonyms.map((s, i) => (
                        <Badge key={i} variant="secondary" className="mr-1 mb-1">{s}</Badge>
                      ))}
                    </div>
                  )}
                  {analysis.antonyms?.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground mr-2">反义:</span>
                      {analysis.antonyms.map((a, i) => (
                        <Badge key={i} variant="outline" className="mr-1 mb-1">{a}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Memory Tip */}
            {analysis.memory_tip && (
              <Card className="border-chart-4/20 bg-chart-4/5">
                <CardContent className="p-4">
                  <p className="text-sm"><span className="font-medium">记忆技巧: </span>{analysis.memory_tip}</p>
                </CardContent>
              </Card>
            )}

            {/* Sentence Analysis */}
            {analysis.sentence_analysis && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">句子分析</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-mono">{analysis.sentence_analysis.original}</p>
                  <p className="text-muted-foreground">{analysis.sentence_analysis.translation}</p>
                  <Separator />
                  <p>{analysis.sentence_analysis.grammar}</p>
                  {analysis.sentence_analysis.key_phrases?.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <Badge variant="secondary">{p.phrase}</Badge>
                      <span>{p.meaning}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 text-center">
              <Button onClick={() => analyzeWord(selectedWord)} variant="outline">
                <Sparkles className="w-4 h-4 mr-2" />
                AI深度分析此单词
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">词库</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索单词或释义..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1 text-xs">全部</TabsTrigger>
          <TabsTrigger value="0" className="flex-1 text-xs">未学</TabsTrigger>
          <TabsTrigger value="1" className="flex-1 text-xs">认识</TabsTrigger>
          <TabsTrigger value="2" className="flex-1 text-xs">学习中</TabsTrigger>
          <TabsTrigger value="3" className="flex-1 text-xs">已掌握</TabsTrigger>
        </TabsList>
      </Tabs>

      <p className="text-xs text-muted-foreground">共 {total} 个词汇</p>

      {/* Word List */}
      <div className="space-y-1">
        {words.map((w) => (
          <Card key={w.id} className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]"
            onClick={() => onWordClick(w.word)}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{w.word}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{w.meaning}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getMasteryColor(w.mastery_level)} variant="secondary">
                  {getMasteryLabel(w.mastery_level)}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            {page}/{Math.ceil(total / pageSize)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(page + 1)}>
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

// ===== QUIZ PAGE =====
function QuizPage({ onWordClick }: { onWordClick?: (word: string) => void }) {
  const [quizMode, setQuizMode] = useState<'select' | 'quiz' | 'result'>('select');
  const [quizType, setQuizType] = useState<'meaning' | 'spelling' | 'collocation'>('meaning');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [results, setResults] = useState<Array<{ correct: boolean; word: string }>>([]);
  const [loading, setLoading] = useState(false);

  const startQuiz = async () => {
    setLoading(true);
    try {
      // Get some words from vocabulary first
      const vocabRes = await fetch('/api/vocabulary?pageSize=20');
      const vocabData = await vocabRes.json();
      const words = (vocabData.data || []).map((w: VocabWord) => w.word);

      if (words.length < 3) {
        alert('词库中的单词不足，请先导入学习材料');
        setLoading(false);
        return;
      }

      const quizRes = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, quizType, count: 10 }),
      });
      const quizData = await quizRes.json();
      if (quizData.success && quizData.quiz.questions?.length > 0) {
        setQuestions(quizData.quiz.questions);
        setQuizMode('quiz');
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setResults([]);
      } else {
        alert('生成题目失败，请重试');
      }
    } catch {
      alert('网络错误，请重试');
    }
    setLoading(false);
  };

  const handleAnswer = async (answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    setShowExplanation(true);

    const currentQ = questions[currentIndex];
    const isCorrect = answer === currentQ.correct_answer;
    setResults(prev => [...prev, { correct: isCorrect, word: currentQ.word }]);

    // If wrong, add to mistakes
    if (!isCorrect) {
      try {
        await fetch('/api/mistakes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: currentQ.word,
            mistake_type: quizType,
            user_answer: answer,
            correct_answer: currentQ.correct_answer,
          }),
        });
      } catch { /* ignore */ }
    }

    // Update vocabulary mastery
    try {
      const vocabRes = await fetch(`/api/vocabulary?search=${currentQ.word}&pageSize=1`);
      const vocabData = await vocabRes.json();
      if (vocabData.data?.[0]?.id) {
        await fetch('/api/vocabulary', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: vocabData.data[0].id,
            increment_review: true,
            increment_correct: isCorrect,
            mastery_level: isCorrect ? Math.min((vocabData.data[0].mastery_level || 0) + 1, 3) : Math.max((vocabData.data[0].mastery_level || 0) - 1, 0),
          }),
        });
      }
    } catch { /* ignore */ }
  };

  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      setQuizMode('result');
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  if (quizMode === 'select') {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold">词汇测试</h2>
        <p className="text-sm text-muted-foreground">选择测试类型，AI根据词库生成专属测试题</p>

        <div className="space-y-3">
          {[
            { type: 'meaning' as const, icon: BookOpen, title: '词义测试', desc: '给英文选中文释义' },
            { type: 'spelling' as const, icon: Type, title: '拼写测试', desc: '根据释义补全单词' },
            { type: 'collocation' as const, icon: BookMarked, title: '搭配测试', desc: '选择正确搭配短语' },
          ].map(({ type, icon: Icon, title, desc }) => (
            <Card
              key={type}
              className={`cursor-pointer transition-all active:scale-[0.98] ${quizType === type ? 'border-primary shadow-sm' : 'hover:shadow-sm'}`}
              onClick={() => setQuizType(type)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${quizType === type ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`w-5 h-5 ${quizType === type ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {quizType === type && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button onClick={startQuiz} disabled={loading} className="w-full" size="lg">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {loading ? '生成中...' : '开始测试'}
        </Button>
      </div>
    );
  }

  if (quizMode === 'result') {
    const correctCount = results.filter(r => r.correct).length;
    const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold">测试结果</h2>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-primary">{accuracy}%</div>
            <p className="text-sm text-muted-foreground mt-1">正确率</p>
            <div className="flex justify-center gap-6 mt-4">
              <div>
                <p className="text-2xl font-bold text-primary">{correctCount}</p>
                <p className="text-xs text-muted-foreground">正确</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{results.length - correctCount}</p>
                <p className="text-xs text-muted-foreground">错误</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm py-1">
              {r.correct ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <XCircle className="w-4 h-4 text-destructive" />}
              <span className="font-mono">{r.word}</span>
              <span className={r.correct ? 'text-primary' : 'text-destructive'}>{r.correct ? '正确' : '错误'}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setQuizMode('select')} className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />
            重新测试
          </Button>
        </div>
      </div>
    );
  }

  // Quiz in progress
  const currentQ = questions[currentIndex];
  return (
    <div className="p-4 space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{currentIndex + 1}/{questions.length}</span>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="flex-1" />
      </div>

      {/* Question */}
      <Card>
        <CardContent className="p-5">
          <Badge variant="secondary" className="mb-3">{currentQ.type}</Badge>
          <p className="text-base font-medium">
            {onWordClick ? <ClickableText text={currentQ.question} onWordClick={onWordClick} /> : currentQ.question}
          </p>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="space-y-2">
        {Object.entries(currentQ.options).map(([key, value]) => {
          const isSelected = selectedAnswer === key;
          const isCorrect = key === currentQ.correct_answer;
          let optionClass = 'border-border hover:border-primary/50';
          if (selectedAnswer) {
            if (isCorrect) optionClass = 'border-primary bg-primary/5';
            else if (isSelected) optionClass = 'border-destructive bg-destructive/5';
          }

          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all ${optionClass} ${!selectedAnswer ? 'active:scale-[0.99]' : ''}`}
              onClick={() => !selectedAnswer && handleAnswer(key)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedAnswer && isCorrect ? 'bg-primary text-primary-foreground' :
                  selectedAnswer && isSelected ? 'bg-destructive text-destructive-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {selectedAnswer && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                   selectedAnswer && isSelected ? <XCircle className="w-4 h-4" /> : key}
                </span>
                <span className="text-sm">
                  {onWordClick ? <ClickableText text={value} onWordClick={onWordClick} /> : value}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Explanation */}
      {showExplanation && (
        <>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-sm">
              <p className="font-medium mb-1">{selectedAnswer === currentQ.correct_answer ? '回答正确!' : '回答错误'}</p>
              <p className="text-muted-foreground">
                {onWordClick ? <ClickableText text={currentQ.explanation} onWordClick={onWordClick} /> : currentQ.explanation}
              </p>
            </CardContent>
          </Card>
          <Button onClick={nextQuestion} className="w-full">
            {currentIndex + 1 >= questions.length ? '查看结果' : '下一题'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </>
      )}
    </div>
  );
}

// ===== MISTAKES PAGE =====
function MistakesPage() {
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);

  const fetchMistakes = useCallback(async () => {
    try {
      const res = await fetch(`/api/mistakes?resolved=${showResolved}`);
      const data = await res.json();
      if (data.success) setMistakes(data.data || []);
    } catch { /* ignore */ }
  }, [showResolved]);

  useEffect(() => { fetchMistakes(); }, [fetchMistakes]);

  const resolveMistake = async (id: string) => {
    try {
      await fetch('/api/mistakes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_resolved: true }),
      });
      fetchMistakes();
    } catch { /* ignore */ }
  };

  const startReview = () => {
    const unresolved = mistakes.filter(m => !m.is_resolved);
    if (unresolved.length === 0) return;
    setMistakes(unresolved);
    setReviewMode(true);
    setReviewIndex(0);
  };

  const getMistakeTypeLabel = (type: string) => {
    const labels: Record<string, string> = { spelling: '拼写', meaning: '词义', usage: '用法', grammar: '语法' };
    return labels[type] || type;
  };

  if (reviewMode && mistakes[reviewIndex]) {
    const current = mistakes[reviewIndex];
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReviewMode(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <span className="text-sm text-muted-foreground">{reviewIndex + 1}/{mistakes.length}</span>
        </div>

        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground mb-2">请回忆这个单词的意思</p>
            <p className="text-3xl font-bold font-mono">{current.word}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">正确答案: <span className="text-primary">{current.correct_answer}</span></p>
            {current.user_answer && (
              <p className="text-sm text-muted-foreground">你的答案: <span className="text-destructive">{current.user_answer}</span></p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              if (reviewIndex + 1 < mistakes.length) {
                setReviewIndex(prev => prev + 1);
              } else {
                setReviewMode(false);
                fetchMistakes();
              }
            }}
          >
            <XCircle className="w-4 h-4 mr-2 text-destructive" />
            还是不会
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              await resolveMistake(current.id);
              if (reviewIndex + 1 < mistakes.length) {
                setReviewIndex(prev => prev + 1);
              } else {
                setReviewMode(false);
                fetchMistakes();
              }
            }}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            已掌握
          </Button>
        </div>
      </div>
    );
  }

  const unresolvedCount = mistakes.filter(m => !m.is_resolved).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">错题本</h2>
        <Button size="sm" onClick={startReview} disabled={unresolvedCount === 0}>
          <RefreshCw className="w-4 h-4 mr-1" />
          复习 ({unresolvedCount})
        </Button>
      </div>

      <Tabs value={showResolved ? 'resolved' : 'unresolved'} onValueChange={(v) => setShowResolved(v === 'resolved')}>
        <TabsList className="w-full">
          <TabsTrigger value="unresolved" className="flex-1">待复习</TabsTrigger>
          <TabsTrigger value="resolved" className="flex-1">已掌握</TabsTrigger>
        </TabsList>
      </Tabs>

      {mistakes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-primary" />
            <p className="text-sm">{showResolved ? '暂无已掌握的错题' : '太棒了，暂无错题!'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {mistakes.map((m) => (
            <Card key={m.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{m.word}</span>
                    <Badge variant="secondary" className="text-[10px]">{getMistakeTypeLabel(m.mistake_type)}</Badge>
                    {m.review_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">复习{m.review_count}次</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    正确: {m.correct_answer}
                  </p>
                </div>
                {!m.is_resolved ? (
                  <Button variant="ghost" size="sm" onClick={() => resolveMistake(m.id)}>
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                ) : (
                  <Badge className="bg-primary/10 text-primary">已掌握</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
