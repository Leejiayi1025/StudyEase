import { pgTable, serial, varchar, text, timestamp, integer, jsonb, boolean, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 学习材料 - 用户导入的文本/图片/文档
export const studyMaterials = pgTable(
	"study_materials",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		title: varchar("title", { length: 255 }).notNull(),
		content: text("content").notNull(),
		source_type: varchar("source_type", { length: 20 }).notNull().default("text"), // text, image, document
		file_key: varchar("file_key", { length: 500 }), // S3 object key if uploaded file
		analysis: jsonb("analysis"), // LLM analysis result
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("study_materials_created_at_idx").on(table.created_at),
	]
);

// 提取的题目
export const questions = pgTable(
	"questions",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		material_id: varchar("material_id", { length: 36 }).notNull().references(() => studyMaterials.id, { onDelete: "cascade" }),
		question_text: text("question_text").notNull(),
		options: jsonb("options"), // { A: "...", B: "...", C: "...", D: "..." }
		correct_answer: varchar("correct_answer", { length: 10 }),
		explanation: text("explanation"),
		question_type: varchar("question_type", { length: 30 }).notNull().default("reading"), // reading, vocabulary, grammar
		analysis: jsonb("analysis"), // word-by-word analysis
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("questions_material_id_idx").on(table.material_id),
		index("questions_type_idx").on(table.question_type),
	]
);

// 四级词汇表
export const vocabulary = pgTable(
	"vocabulary",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		word: varchar("word", { length: 200 }).notNull(),
		phonetic: varchar("phonetic", { length: 200 }),
		part_of_speech: varchar("part_of_speech", { length: 100 }), // noun, verb, adj, etc.
		meaning: text("meaning").notNull(), // Chinese meaning
		example_sentence: text("example_sentence"),
		example_translation: text("example_translation"),
		common_phrases: jsonb("common_phrases"), // [{ phrase: "...", meaning: "..." }]
		word_forms: jsonb("word_forms"), // { original: "...", past: "...", past_participle: "...", etc. }
		synonyms: jsonb("synonyms"), // ["同义词1", "同义词2"]
		antonyms: jsonb("antonyms"), // ["反义词1"]
		difficulty: varchar("difficulty", { length: 20 }).default("medium"), // easy, medium, hard
		mastery_level: integer("mastery_level").default(0), // 0=unknown, 1=seen, 2=learning, 3=mastered
		review_count: integer("review_count").default(0),
		correct_count: integer("correct_count").default(0),
		last_reviewed_at: timestamp("last_reviewed_at", { withTimezone: true }),
		is_cet4_core: boolean("is_cet4_core").default(false),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("vocabulary_word_idx").on(table.word),
		index("vocabulary_mastery_idx").on(table.mastery_level),
		index("vocabulary_cet4_core_idx").on(table.is_cet4_core),
	]
);

// 错题本
export const mistakes = pgTable(
	"mistakes",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		word: varchar("word", { length: 200 }).notNull(),
		mistake_type: varchar("mistake_type", { length: 30 }).notNull(), // spelling, meaning, usage, grammar
		user_answer: text("user_answer"),
		correct_answer: text("correct_answer"),
		question_id: varchar("question_id", { length: 36 }).references(() => questions.id),
		vocabulary_id: varchar("vocabulary_id", { length: 36 }).references(() => vocabulary.id),
		is_resolved: boolean("is_resolved").default(false),
		review_count: integer("review_count").default(0),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		resolved_at: timestamp("resolved_at", { withTimezone: true }),
	},
	(table) => [
		index("mistakes_word_idx").on(table.word),
		index("mistakes_resolved_idx").on(table.is_resolved),
		index("mistakes_created_at_idx").on(table.created_at),
	]
);

// 学习进度
export const studyProgress = pgTable(
	"study_progress",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
		words_learned: integer("words_learned").default(0),
		words_reviewed: integer("words_reviewed").default(0),
		questions_attempted: integer("questions_attempted").default(0),
		questions_correct: integer("questions_correct").default(0),
		study_minutes: integer("study_minutes").default(0),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("study_progress_date_idx").on(table.date),
	]
);
