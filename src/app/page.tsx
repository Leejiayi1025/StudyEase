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
  Camera,
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
        <WordPopup word={popupWord} open={!!popupWord} onClose={() => setPopupWord(null)} onWordClick={(w) => setPopupWord(w)} />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && <HomePage stats={stats} onNavigate={setActiveTab} />}
        {activeTab === 'import' && <ImportPage onDone={fetchProgress} onWordClick={handleWordClick} />}
        {activeTab === 'questions' && <QuestionBankPage onWordClick={handleWordClick} />}
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
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ file: File; preview: string; base64: string }>>([]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newImages = await Promise.all(
      files.map(async (file) => ({
        file,
        preview: URL.createObjectURL(file),
        base64: await fileToBase64(file),
      }))
    );
    setSelectedImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Step 1: Analyze only (don't save)
  const handleAnalyze = async () => {
    const isText = importType === 'text';
    if (isText && !textContent.trim()) return;
    if (!isText && selectedImages.length === 0) return;

    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = isText
        ? { content: textContent, sourceType: 'text', title: title || undefined }
        : {
            images: selectedImages.map(img => ({ data: img.base64, mimeType: img.file.type || 'image/png' })),
            sourceType: 'image',
            title: title || `图片导入 (${selectedImages.length}张)`,
          };

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.analysis as Record<string, unknown>);
      } else {
        setResult({ error: data.error });
      }
    } catch {
      setResult({ error: '识别失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save to question bank
  const handleSave = async () => {
    if (!result || saved) return;
    setSaving(true);
    try {
      const isText = importType === 'text';
      const body: Record<string, unknown> = isText
        ? { content: textContent, sourceType: 'text', title: title || undefined, save: { analysis: result } }
        : {
            images: selectedImages.map(img => ({ data: img.base64, mimeType: img.file.type || 'image/png' })),
            sourceType: 'image',
            title: title || `图片导入 (${selectedImages.length}张)`,
            save: { analysis: result },
          };

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        onDone();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  // Discard and reset
  const handleDiscard = () => {
    setResult(null);
    setSaved(false);
    setSelectedImages([]);
    setTextContent('');
  };

  const hasResult = result !== null;
  const hasError: boolean = hasResult && 'error' in result && Boolean(result.error);
  const hasQuestions: boolean = hasResult && 'questions' in result;
  const [resultView, setResultView] = useState<'reading' | 'questions' | 'vocabulary'>('reading');

  // Derive data from result
  const article = hasResult && result && 'article' in result ? result.article as { original?: string; translation?: string; sentences?: Array<{ english: string; chinese: string }> } | null : null;
  const questions = hasResult && result && 'questions' in result ? (result.questions as Array<Record<string, unknown>>) : [];
  const vocab = hasResult && result && 'vocabulary' in result ? (result.vocabulary as Array<Record<string, unknown>>) : [];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">导入学习材料</h2>
      <p className="text-sm text-muted-foreground">粘贴英语文章或上传图片，AI逐句翻译、提取生词、出题引导</p>

      {/* Type Selector */}
      <div className="flex gap-2">
        <Button variant={importType === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setImportType('text')} className="flex-1">
          <Type className="w-4 h-4 mr-1" />粘贴文本
        </Button>
        <Button variant={importType === 'image' ? 'default' : 'outline'} size="sm" onClick={() => setImportType('image')} className="flex-1">
          <ImageIcon className="w-4 h-4 mr-1" />上传图片
        </Button>
      </div>

      {importType === 'text' ? (
        <div className="space-y-3">
          <Input placeholder="标题（可选）" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="粘贴英语文章、阅读理解、完形填空等内容..." className="min-h-[200px] text-sm" value={textContent} onChange={(e) => setTextContent(e.target.value)} />
          <Button onClick={handleAnalyze} disabled={loading || !textContent.trim()} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? 'AI识别中...' : '智能识别分析'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Upload buttons */}
          <div className="grid grid-cols-2 gap-2">
            <label className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
              <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">从相册选图</p>
              <p className="text-[10px] text-muted-foreground">支持多选</p>
            </label>
            <label className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
              <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">拍照上传</p>
              <p className="text-[10px] text-muted-foreground">摄像头拍摄</p>
            </label>
          </div>

          {/* Image previews */}
          {selectedImages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">已选 {selectedImages.length} 张图片</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedImages([])} className="h-6 text-xs text-destructive">
                  清空
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedImages.map((img, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={img.preview} alt={`图片${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-border" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                    >×</button>
                  </div>
                ))}
              </div>
              <Input placeholder="标题（可选）" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button onClick={handleAnalyze} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {loading ? 'AI识别中...' : `识别 ${selectedImages.length} 张图片`}
              </Button>
            </div>
          )}

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
        <div className="space-y-3">
          {/* Stats + Save/Discard */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" />{questions.length} 道题</Badge>
              <Badge variant="secondary"><BookMarked className="w-3 h-3 mr-1" />{vocab.length} 个生词</Badge>
            </div>
            {!saved ? (
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={handleDiscard} className="h-7 text-xs text-muted-foreground">
                  <XCircle className="w-3 h-3 mr-1" />丢弃
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
                  {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {saving ? '保存中...' : '保存到题库'}
                </Button>
              </div>
            ) : (
              <Badge className="bg-primary/10 text-primary"><CheckCircle2 className="w-3 h-3 mr-1" />已保存</Badge>
            )}
          </div>

          {/* View Tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {[
              { key: 'reading' as const, label: '📖 精读' },
              { key: 'questions' as const, label: '📝 答题' },
              { key: 'vocabulary' as const, label: '📚 生词' },
            ].map(v => (
              <button key={v.key} onClick={() => setResultView(v.key)}
                className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${resultView === v.key ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Reading View */}
          {resultView === 'reading' && article && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="text-sm font-bold">文章精读</h3>
                {article.sentences && article.sentences.length > 0 ? (
                  <div className="space-y-3">
                    {article.sentences.map((s, i) => (
                      <div key={i} className="border-l-2 border-primary/30 pl-3">
                        <p className="text-sm font-mono leading-relaxed">
                          <ClickableText text={s.english} onWordClick={onWordClick} />
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{s.chinese}</p>
                      </div>
                    ))}
                  </div>
                ) : article.original ? (
                  <div className="space-y-2">
                    <p className="text-sm font-mono leading-relaxed"><ClickableText text={article.original} onWordClick={onWordClick} /></p>
                    {article.translation && <p className="text-xs text-muted-foreground">{article.translation}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无文章内容</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Questions View */}
          {resultView === 'questions' && questions.map((q, i) => (
            <ImportQuestionCard key={i} question={q} index={i} onWordClick={onWordClick} />
          ))}

          {/* Vocabulary View */}
          {resultView === 'vocabulary' && (
            <div className="space-y-1">
              {vocab.map((v, i) => (
                <Card key={i} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => onWordClick(v.word as string)}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm">{String(v.word || '')}</span>
                        {v.part_of_speech ? <Badge variant="secondary" className="text-[10px]">{String(v.part_of_speech)}</Badge> : null}
                        {v.source ? <Badge variant="outline" className="text-[10px]">{String(v.source)}</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{String(v.meaning || '')}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {hasError && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-destructive text-sm">{String(result?.error)}</CardContent>
        </Card>
      )}
    </div>
  );
}

// Import Question Card with Socratic hints
function ImportQuestionCard({ question, index, onWordClick }: { question: Record<string, unknown>; index: number; onWordClick: (word: string) => void }) {
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const options = (question.options || {}) as Record<string, string>;
  const optionsTranslation = (question.options_translation || {}) as Record<string, string>;
  const hints = (question.socratic_hints || []) as string[];
  const correctAnswer = question.correct_answer as string;

  const handleAnswer = (key: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(key);
    setShowResult(true);
  };

  const nextHint = () => {
    if (hintIndex < hints.length - 1) {
      setHintIndex(prev => prev + 1);
    }
  };

  return (
    <Card className="border-primary/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="shrink-0">Q{index + 1}</Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium"><ClickableText text={String(question.question_text || '')} onWordClick={onWordClick} /></p>
            {question.question_translation ? <p className="text-xs text-muted-foreground mt-1">{String(question.question_translation)}</p> : null}
          </div>
        </div>

        {/* Options with translations */}
        <div className="space-y-1.5">
          {Object.entries(options).map(([key, value]) => {
            const isSelected = selectedAnswer === key;
            const isCorrect = key === correctAnswer;
            let cls = 'border-border hover:border-primary/50 cursor-pointer';
            if (showResult) {
              if (isCorrect) cls = 'border-primary bg-primary/5';
              else if (isSelected) cls = 'border-destructive bg-destructive/5';
              else cls = 'border-border opacity-50';
            }
            return (
              <div key={key} className={`p-2 rounded border text-sm transition-colors ${cls}`} onClick={() => handleAnswer(key)}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    showResult && isCorrect ? 'bg-primary text-primary-foreground' :
                    showResult && isSelected ? 'bg-destructive text-destructive-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>{key}</span>
                  <span className="flex-1"><ClickableText text={value} onWordClick={onWordClick} /></span>
                  {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                </div>
                {optionsTranslation[key] && <p className="text-xs text-muted-foreground ml-7 mt-0.5">{optionsTranslation[key]}</p>}
              </div>
            );
          })}
        </div>

        {/* Socratic Hints or Result */}
        {!showResult && !showHint && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowHint(true)}>
            <Sparkles className="w-3 h-3 mr-1" />我要引导思考（不直接看答案）
          </Button>
        )}

        {!showResult && showHint && hints.length > 0 && (
          <Card className="bg-chart-4/5 border-chart-4/20">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-medium text-chart-4">💡 思考引导 ({hintIndex + 1}/{hints.length})</p>
              <p className="text-sm">{hints[hintIndex]}</p>
              <div className="flex gap-2">
                {hintIndex < hints.length - 1 && (
                  <Button variant="ghost" size="sm" onClick={nextHint}>下一个提示</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowHint(false)}>隐藏</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showResult && (
          <div className="space-y-2">
            <Card className={selectedAnswer === correctAnswer ? 'border-primary/20 bg-primary/5' : 'border-destructive/20 bg-destructive/5'}>
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-1">{selectedAnswer === correctAnswer ? '✅ 回答正确!' : '❌ 回答错误'}</p>
                <p className="text-xs text-muted-foreground">{question.explanation as string}</p>
              </CardContent>
            </Card>
            {hints.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">查看苏格拉底引导</summary>
                <div className="mt-2 space-y-1 pl-3 border-l-2 border-chart-4/30">
                  {hints.map((h, i) => <p key={i} className="text-muted-foreground">{h}</p>)}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== WORD POPUP =====
function WordPopup({ word, open, onClose, onWordClick }: { word: string; open: boolean; onClose: () => void; onWordClick?: (word: string) => void }) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);

  const fetchAnalysis = useCallback(async (forceAI = false) => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, forceAI }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        setFromCache(!!data.fromCache);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [word]);

  useEffect(() => {
    if (!open || !word) return;
    setAnalysis(null);
    setQuizQuestions([]);
    setShowQuiz(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setFromCache(false);
    fetchAnalysis();
  }, [word, open, fetchAnalysis]);

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
              <div className="space-y-2">
                {analysis.synonyms?.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground mr-1.5">同义:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.synonyms.map((s, i) => (
                        <span key={i} className="cursor-pointer text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid bg-primary/5 px-1.5 py-0.5 rounded text-xs" onClick={() => onWordClick?.(s)}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.antonyms?.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground mr-1.5">反义:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.antonyms.map((a, i) => (
                        <span key={i} className="cursor-pointer text-destructive underline decoration-dotted underline-offset-2 hover:decoration-solid bg-destructive/5 px-1.5 py-0.5 rounded text-xs" onClick={() => onWordClick?.(a)}>{a}</span>
                      ))}
                    </div>
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

            {/* Deep Analysis Button (when cached) */}
            {fromCache && !deepAnalyzing && (
              <Button variant="outline" className="w-full" onClick={() => { setDeepAnalyzing(true); fetchAnalysis(true).then(() => setDeepAnalyzing(false)); }}>
                <Sparkles className="w-4 h-4 mr-2" />
                AI 深度分析（获取词根、同义词等）
              </Button>
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
type QuestionItem = {
  id: string;
  question_text: string;
  options: Record<string, string>;
  options_translation?: Record<string, string>;
  question_translation?: string;
  socratic_hints?: string[];
  correct_answer: string;
  explanation: string;
  question_type: string;
  question_type_cn?: string;
  material_id: string;
};

type MaterialItem = {
  id: string;
  title: string;
  source_type: string;
  created_at: string;
  question_count: number;
  reading_count: number;
  cloze_count: number;
  vocabulary_count: number;
  translation_count: number;
  writing_count: number;
};

function QuestionBankPage({ onWordClick }: { onWordClick?: (word: string) => void }) {
  const [view, setView] = useState<'list' | 'detail' | 'quiz' | 'result'>('list');
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [materialQuestions, setMaterialQuestions] = useState<QuestionItem[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuestionItem[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizResults, setQuizResults] = useState<Array<{ correct: boolean; questionId: string }>>([]);

  // Fetch materials list
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/materials?pageSize=50');
      const data = await res.json();
      if (data.success) setMaterials(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  // Fetch questions for a material
  const [materialArticle, setMaterialArticle] = useState<{ original?: string; translation?: string; sentences?: Array<{ english: string; chinese: string }> } | null>(null);

  const openMaterial = async (material: MaterialItem) => {
    setSelectedMaterial(material);
    setLoading(true);
    try {
      // Fetch material detail (with article) and questions in parallel
      const [materialRes, questionsRes] = await Promise.all([
        fetch(`/api/materials?id=${material.id}`),
        fetch(`/api/questions?material_id=${material.id}&pageSize=100`),
      ]);
      const materialData = await materialRes.json();
      const questionsData = await questionsRes.json();

      if (materialData.success && materialData.data?.analysis) {
        const analysis = materialData.data.analysis;
        setMaterialArticle(analysis.article || null);
      }
      if (questionsData.success) setMaterialQuestions(questionsData.data || []);
    } catch { /* ignore */ }
    setLoading(false);
    setView('detail');
  };

  // Start quiz from material questions
  const startQuiz = (typeFilter?: string) => {
    let qs = [...materialQuestions];
    if (typeFilter && typeFilter !== 'all') {
      qs = qs.filter(q => q.question_type === typeFilter);
    }
    if (qs.length === 0) return;
    setQuizQuestions(qs);
    setQuizResults([]);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setView('quiz');
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

  const nextQuestion = () => {
    if (quizIndex + 1 >= quizQuestions.length) {
      setView('result');
    } else {
      setQuizIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const typeLabels: Record<string, string> = { reading: '阅读理解', cloze: '完型填空', vocabulary: '词汇选择', translation: '翻译题', writing: '作文题', grammar: '语法' };
  const typeColors: Record<string, string> = { reading: 'bg-chart-1/10 text-chart-1', cloze: 'bg-chart-2/10 text-chart-2', vocabulary: 'bg-chart-4/10 text-chart-4', translation: 'bg-chart-3/10 text-chart-3', writing: 'bg-primary/10 text-primary' };
  const typeIcons: Record<string, string> = { reading: '📖', cloze: '📝', vocabulary: '📚', translation: '🌐', writing: '✍️' };

  // ===== Result View =====
  if (view === 'result') {
    const correctCount = quizResults.filter(r => r.correct).length;
    const accuracy = quizResults.length > 0 ? Math.round((correctCount / quizResults.length) * 100) : 0;
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold">测试结果</h2>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-primary">{accuracy}%</div>
            <p className="text-sm text-muted-foreground mt-1">正确率</p>
            <div className="flex justify-center gap-6 mt-4">
              <div><p className="text-2xl font-bold text-primary">{correctCount}</p><p className="text-xs text-muted-foreground">正确</p></div>
              <div><p className="text-2xl font-bold text-destructive">{quizResults.length - correctCount}</p><p className="text-xs text-muted-foreground">错误</p></div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('detail')} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" />返回题目
          </Button>
          <Button onClick={() => startQuiz()} className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />再做一次
          </Button>
        </div>
      </div>
    );
  }

  // ===== Quiz View =====
  if (view === 'quiz' && quizQuestions[quizIndex]) {
    const q = quizQuestions[quizIndex];
    const hints = q.socratic_hints || [];
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView('detail')}>
            <ArrowLeft className="w-4 h-4 mr-1" />退出
          </Button>
          <span className="text-sm text-muted-foreground">{quizIndex + 1}/{quizQuestions.length}</span>
          <Progress value={((quizIndex + 1) / quizQuestions.length) * 100} className="flex-1" />
          <Badge variant="secondary" className="text-xs">{typeLabels[q.question_type] || q.question_type}</Badge>
        </div>

        <Card>
          <CardContent className="p-5">
            <p className="text-base font-medium">{q.question_text}</p>
            {q.question_translation && <p className="text-xs text-muted-foreground mt-1">{q.question_translation}</p>}
          </CardContent>
        </Card>

        {!selectedAnswer && hints.length > 0 && (
          <Card className="bg-chart-4/5 border-chart-4/20">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-chart-4 mb-1">💡 思考引导</p>
              <p className="text-sm">{hints[0]}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {Object.entries(q.options).map(([key, value]) => {
            const isSelected = selectedAnswer === key;
            const isCorrect = key === q.correct_answer;
            let cls = 'border-border hover:border-primary/50';
            if (selectedAnswer) {
              if (isCorrect) cls = 'border-primary bg-primary/5';
              else if (isSelected) cls = 'border-destructive bg-destructive/5';
            }
            return (
              <Card key={key} className={`cursor-pointer transition-all ${cls}`} onClick={() => handleQuizAnswer(key)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      selectedAnswer && isCorrect ? 'bg-primary text-primary-foreground' :
                      selectedAnswer && isSelected ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {selectedAnswer && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                       selectedAnswer && isSelected ? <XCircle className="w-4 h-4" /> : key}
                    </span>
                    <span className="text-sm">{value}</span>
                  </div>
                  {q.options_translation?.[key] && <p className="text-xs text-muted-foreground ml-10 mt-0.5">{q.options_translation[key]}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {showExplanation && (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm">
                <p className="font-medium mb-1">{selectedAnswer === q.correct_answer ? '✅ 正确!' : '❌ 错误'}</p>
                <p className="text-muted-foreground">{q.explanation}</p>
                {hints.length > 1 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">完整引导</summary>
                    <div className="mt-1 space-y-1">{hints.map((h, i) => <p key={i}>{h}</p>)}</div>
                  </details>
                )}
              </CardContent>
            </Card>
            <Button onClick={nextQuestion} className="w-full">
              {quizIndex + 1 >= quizQuestions.length ? '查看结果' : '下一题'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}
      </div>
    );
  }

  // ===== Detail View (完整试卷) =====
  if (view === 'detail' && selectedMaterial) {
    const grouped: Record<string, QuestionItem[]> = {};
    for (const q of materialQuestions) {
      const type = q.question_type || 'reading';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(q);
    }
    const typeOrder = ['reading', 'cloze', 'vocabulary', 'translation', 'writing'];

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setView('list'); setSelectedMaterial(null); setMaterialArticle(null); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />返回题库
          </Button>
          <span className="text-sm font-medium flex-1 truncate">{selectedMaterial.title}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button onClick={() => startQuiz('all')} size="sm" className="flex-1">
            <Play className="w-4 h-4 mr-1" />全部重做 ({materialQuestions.length}题)
          </Button>
          {Object.entries(grouped).filter(([, qs]) => qs.length > 0).map(([type, qs]) => (
            <Button key={type} variant="outline" size="sm" onClick={() => startQuiz(type)}>
              {typeIcons[type] || '📋'} {typeLabels[type] || type} ({qs.length})
            </Button>
          ))}
        </div>

        {/* ===== Complete Article ===== */}
        {materialArticle && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                📖 原文
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Full article text */}
              {materialArticle.sentences && materialArticle.sentences.length > 0 ? (
                <div className="space-y-2">
                  {materialArticle.sentences.map((s, i) => (
                    <div key={i} className="border-l-2 border-primary/20 pl-3">
                      <p className="text-sm leading-relaxed"><ClickableText text={s.english} onWordClick={(w) => onWordClick?.(w)} /></p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.chinese}</p>
                    </div>
                  ))}
                </div>
              ) : materialArticle.original ? (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap"><ClickableText text={materialArticle.original} onWordClick={(w) => onWordClick?.(w)} /></p>
                  {materialArticle.translation && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{materialArticle.translation}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* ===== Complete Questions ===== */}
        {typeOrder.filter(t => grouped[t]).map(type => (
          <div key={type} className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              {typeIcons[type] || '📋'} {typeLabels[type] || type}
              <Badge variant="secondary" className="text-xs">{grouped[type].length}题</Badge>
            </h3>
            {grouped[type].map((q, i) => (
              <Card key={q.id} className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  {/* Question text */}
                  <div>
                    <p className="text-sm font-medium">
                      <span className="text-primary mr-1">{i + 1}.</span>
                      <ClickableText text={q.question_text} onWordClick={(w) => onWordClick?.(w)} />
                    </p>
                    {q.question_translation && <p className="text-xs text-muted-foreground mt-1">{q.question_translation}</p>}
                  </div>

                  {/* Options with translations */}
                  <div className="space-y-1.5">
                    {Object.entries(q.options).map(([key, value]) => (
                      <div key={key} className={`text-sm p-2 rounded border ${
                        key === q.correct_answer ? 'border-primary/30 bg-primary/5' : 'border-border/50'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            key === q.correct_answer ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>{key}</span>
                          <div className="flex-1 min-w-0">
                            <p><ClickableText text={value} onWordClick={(w) => onWordClick?.(w)} /></p>
                            {q.options_translation?.[key] && (
                              <p className="text-xs text-muted-foreground mt-0.5">{q.options_translation[key]}</p>
                            )}
                          </div>
                          {key === q.correct_answer && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Explanation */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">📝 查看解析</summary>
                    <div className="mt-2 space-y-2">
                      <div className="p-2.5 bg-muted/30 rounded">
                        <p className="whitespace-pre-wrap">{q.explanation}</p>
                      </div>
                      {q.socratic_hints && q.socratic_hints.length > 0 && (
                        <div className="p-2.5 bg-chart-4/5 border border-chart-4/20 rounded">
                          <p className="font-medium text-chart-4 mb-1">💡 苏格拉底引导</p>
                          {q.socratic_hints.map((h, hi) => <p key={hi} className="mt-1">{h}</p>)}
                        </div>
                      )}
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ===== List View (套题列表) =====
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">题库</h2>
      <p className="text-xs text-muted-foreground">共 {materials.length} 套题</p>

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
      ) : materials.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BookMarked className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">题库为空，请先导入学习材料</p>
            <p className="text-xs mt-1">支持粘贴文章、上传图片、拍照</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {materials.map(m => (
            <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]" onClick={() => openMaterial(m)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{m.source_type === 'image' ? '📷' : '📄'}</span>
                      <h3 className="font-medium text-sm truncate">{m.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs">共 {m.question_count} 题</Badge>
                      {m.reading_count > 0 && <Badge className="text-[10px] bg-chart-1/10 text-chart-1">📖阅读 {m.reading_count}</Badge>}
                      {m.cloze_count > 0 && <Badge className="text-[10px] bg-chart-2/10 text-chart-2">📝完型 {m.cloze_count}</Badge>}
                      {m.vocabulary_count > 0 && <Badge className="text-[10px] bg-chart-4/10 text-chart-4">📚词汇 {m.vocabulary_count}</Badge>}
                      {m.translation_count > 0 && <Badge className="text-[10px] bg-chart-3/10 text-chart-3">🌐翻译 {m.translation_count}</Badge>}
                      {m.writing_count > 0 && <Badge className="text-[10px] bg-primary/10 text-primary">✍️作文 {m.writing_count}</Badge>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
