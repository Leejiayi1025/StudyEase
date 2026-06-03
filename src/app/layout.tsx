import type { Metadata } from "next";
import { Inspector } from "react-dev-inspector";
import './globals.css';

export const metadata: Metadata = {
  title: 'StudyEase | 智能英语学习助手',
  description: 'AI驱动的英语学习工具，支持导入材料智能分析、逐词逐句翻译、题库刷题、错题本和自适应测试',
  keywords: ['英语', '学习', '词汇', '题库', '刷题', 'AI', 'StudyEase'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
