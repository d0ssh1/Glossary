// ============================================================
// MOCK DATA — Lexicon Weaver
// ============================================================
import type { Course, Term, GraphNode, GraphLink, LinkType } from '@/types';

// --- Terms for Course 1, Module 1, Lesson 1 ---
const termsM1L1: Term[] = [
  {
    id: 't-m1l1-1', name: 'Алгоритм', status: 'ready',
    definition: 'Набор инструкций для решения задачи или выполнения вычислений.',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [
      { id: 'o1', snippet: '...В этом <b>алгоритме</b> мы видим классический подход к сортировке данных...', highlightedTerm: 'алгоритме', moduleId: 'm1', lessonId: 'm1l1', stepId: 's1', stepName: 'Шаг 1. Понятие алгоритма' },
      { id: 'o2', snippet: '...Каждый <b>алгоритм</b> должен обладать свойством результативности...', highlightedTerm: 'алгоритм', moduleId: 'm1', lessonId: 'm1l1', stepId: 's2', stepName: 'Шаг 2. Свойства алгоритмов' },
    ],
    connections: [
      { id: 'c1', moduleId: 'm1', moduleName: 'Модуль 1. Основы', lessonId: 'm1l1', lessonName: 'Урок 1.1. Алгоритмы', stepId: 's1', stepName: 'Шаг 1. Понятие алгоритма', type: 'editor' },
      { id: 'c2', moduleId: 'm1', moduleName: 'Модуль 1. Основы', lessonId: 'm1l1', lessonName: 'Урок 1.1. Алгоритмы', stepId: 's2', stepName: 'Шаг 2. Свойства алгоритмов', type: 'system' },
    ],
  },
  {
    id: 't-m1l1-2', name: 'База данных', status: 'in-progress',
    definition: '',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [
      { id: 'o3', snippet: '...<b>База данных</b> — это организованная коллекция структурированных данных...', highlightedTerm: 'База данных', moduleId: 'm1', lessonId: 'm1l1', stepId: 's3', stepName: 'Шаг 3. Введение в БД' },
    ],
    connections: [
      { id: 'c3', moduleId: 'm1', moduleName: 'Модуль 1. Основы', lessonId: 'm1l1', lessonName: 'Урок 1.1. Алгоритмы', stepId: 's3', stepName: 'Шаг 3. Введение в БД', type: 'system' },
    ],
  },
  {
    id: 't-m1l1-3', name: 'Газета', status: 'no-trait',
    definition: '',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [
      { id: 'o4', snippet: '...Термин <b>газета</b> в данном контексте используется метафорически...', highlightedTerm: 'газета', moduleId: 'm1', lessonId: 'm1l1', stepId: 's4', stepName: 'Шаг 4. Метафоры' },
    ],
    connections: [
      { id: 'c4', moduleId: 'm1', moduleName: 'Модуль 1. Основы', lessonId: 'm1l1', lessonName: 'Урок 1.1. Алгоритмы', stepId: 's4', stepName: 'Шаг 4. Метафоры', type: 'system' },
    ],
  },
  {
    id: 't-m1l1-4', name: 'Глеб', status: 'in-progress',
    definition: 'Имя собственное, пример пользователя в системе.',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [
      { id: 'o5', snippet: '...Пользователь <b>Глеб</b> заходит в систему и видит dashboard...', highlightedTerm: 'Глеб', moduleId: 'm1', lessonId: 'm1l1', stepId: 's5', stepName: 'Шаг 5. Пользователи' },
    ],
    connections: [
      { id: 'c5', moduleId: 'm1', moduleName: 'Модуль 1. Основы', lessonId: 'm1l1', lessonName: 'Урок 1.1. Алгоритмы', stepId: 's5', stepName: 'Шаг 5. Пользователи', type: 'editor' },
    ],
  },
  {
    id: 't-m1l1-5', name: 'Груздь', status: 'no-trait',
    definition: '',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [],
    connections: [],
  },
  {
    id: 't-m1l1-6', name: 'Декомпозиция', status: 'ready',
    definition: 'Разбиение сложной системы на более простые подсистемы.',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [
      { id: 'o6', snippet: '...<b>Декомпозиция</b> задачи — ключевой навык программиста...', highlightedTerm: 'Декомпозиция', moduleId: 'm1', lessonId: 'm1l1', stepId: 's6', stepName: 'Шаг 6. Разбиение задач' },
    ],
    connections: [
      { id: 'c6', moduleId: 'm1', moduleName: 'Модуль 1. Основы', lessonId: 'm1l1', lessonName: 'Урок 1.1. Алгоритмы', stepId: 's6', stepName: 'Шаг 6. Разбиение задач', type: 'system' },
    ],
  },
  {
    id: 't-m1l1-7', name: 'Единица измерения', status: 'ready',
    definition: 'Стандартизированная величина для измерения физических свойств.',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [],
    connections: [],
  },
  {
    id: 't-m1l1-8', name: 'Журнал', status: 'no-trait',
    definition: '',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [],
    connections: [],
  },
  {
    id: 't-m1l1-9', name: 'Запрос', status: 'in-progress',
    definition: '',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [
      { id: 'o7', snippet: '...SQL <b>запрос</b> позволяет извлечь данные из таблицы...', highlightedTerm: 'запрос', moduleId: 'm1', lessonId: 'm1l1', stepId: 's7', stepName: 'Шаг 7. SQL-запросы' },
    ],
    connections: [
      { id: 'c7', moduleId: 'm1', moduleName: 'Модуль 1. Основы', lessonId: 'm1l1', lessonName: 'Урок 1.1. Алгоритмы', stepId: 's7', stepName: 'Шаг 7. SQL-запросы', type: 'system' },
    ],
  },
  {
    id: 't-m1l1-10', name: 'Индекс', status: 'ready',
    definition: 'Структура данных, ускоряющая операции поиска в базе данных.',
    moduleId: 'm1', lessonId: 'm1l1',
    occurrences: [],
    connections: [],
  },
];

// --- Terms for Course 1, Module 1, Lesson 2 ---
const termsM1L2: Term[] = [
  { id: 't-m1l2-1', name: 'Курсор', status: 'in-progress', definition: '', moduleId: 'm1', lessonId: 'm1l2', occurrences: [], connections: [] },
  { id: 't-m1l2-2', name: 'Логика', status: 'ready', definition: 'Наука о формах и законах правильного мышления.', moduleId: 'm1', lessonId: 'm1l2', occurrences: [], connections: [] },
  { id: 't-m1l2-3', name: 'Массив', status: 'ready', definition: 'Структура данных, хранящая набор элементов одного типа.', moduleId: 'm1', lessonId: 'm1l2', occurrences: [], connections: [] },
  { id: 't-m1l2-4', name: 'Нормализация', status: 'no-trait', definition: '', moduleId: 'm1', lessonId: 'm1l2', occurrences: [], connections: [] },
  { id: 't-m1l2-5', name: 'Оптимизация', status: 'in-progress', definition: '', moduleId: 'm1', lessonId: 'm1l2', occurrences: [], connections: [] },
];

// --- Terms for Course 1, Module 2, Lesson 1 ---
const termsM2L1: Term[] = [
  { id: 't-m2l1-1', name: 'Парсинг', status: 'ready', definition: 'Анализ строки данных в структурированный формат.', moduleId: 'm2', lessonId: 'm2l1', occurrences: [], connections: [] },
  { id: 't-m2l1-2', name: 'Рекурсия', status: 'ready', definition: 'Функция, вызывающая саму себя.', moduleId: 'm2', lessonId: 'm2l1', occurrences: [], connections: [] },
  { id: 't-m2l1-3', name: 'Схема', status: 'in-progress', definition: '', moduleId: 'm2', lessonId: 'm2l1', occurrences: [], connections: [] },
  { id: 't-m2l1-4', name: 'Транзакция', status: 'ready', definition: 'Группа операций, выполняемых как единое целое.', moduleId: 'm2', lessonId: 'm2l1', occurrences: [], connections: [] },
  { id: 't-m2l1-5', name: 'Условие', status: 'no-trait', definition: '', moduleId: 'm2', lessonId: 'm2l1', occurrences: [], connections: [] },
];

// --- Terms for Course 1, Module 2, Lesson 2 ---
const termsM2L2: Term[] = [
  { id: 't-m2l2-1', name: 'Функция', status: 'ready', definition: 'Блок кода, выполняющий определённую задачу.', moduleId: 'm2', lessonId: 'm2l2', occurrences: [], connections: [] },
  { id: 't-m2l2-2', name: 'Хэш', status: 'in-progress', definition: '', moduleId: 'm2', lessonId: 'm2l2', occurrences: [], connections: [] },
  { id: 't-m2l2-3', name: 'Цикл', status: 'ready', definition: 'Конструкция, повторяющая блок кода.', moduleId: 'm2', lessonId: 'm2l2', occurrences: [], connections: [] },
  { id: 't-m2l2-4', name: 'Чистота функции', status: 'no-trait', definition: '', moduleId: 'm2', lessonId: 'm2l2', occurrences: [], connections: [] },
  { id: 't-m2l2-5', name: 'Шаблон', status: 'in-progress', definition: '', moduleId: 'm2', lessonId: 'm2l2', occurrences: [], connections: [] },
];

// --- Terms for Course 1, Module 3 ---
const termsM3L1: Term[] = [
  { id: 't-m3l1-1', name: 'JOIN', status: 'ready', definition: 'Операция объединения таблиц в SQL.', moduleId: 'm3', lessonId: 'm3l1', occurrences: [], connections: [] },
  { id: 't-m3l1-2', name: 'Агрегация', status: 'ready', definition: 'Вычисление сводных значений по группе данных.', moduleId: 'm3', lessonId: 'm3l1', occurrences: [], connections: [] },
  { id: 't-m3l1-3', name: 'Вложенный запрос', status: 'in-progress', definition: '', moduleId: 'm3', lessonId: 'm3l1', occurrences: [], connections: [] },
  { id: 't-m3l1-4', name: 'Группировка', status: 'no-trait', definition: '', moduleId: 'm3', lessonId: 'm3l1', occurrences: [], connections: [] },
  { id: 't-m3l1-5', name: 'Исключение', status: 'ready', definition: 'Обработка ошибочных ситуаций в программе.', moduleId: 'm3', lessonId: 'm3l1', occurrences: [], connections: [] },
];

const termsM3L2: Term[] = [
  { id: 't-m3l2-1', name: 'Каскад', status: 'in-progress', definition: '', moduleId: 'm3', lessonId: 'm3l2', occurrences: [], connections: [] },
  { id: 't-m3l2-2', name: 'Миграция', status: 'ready', definition: 'Перенос данных из одной системы в другую.', moduleId: 'm3', lessonId: 'm3l2', occurrences: [], connections: [] },
  { id: 't-m3l2-3', name: 'Представление', status: 'no-trait', definition: '', moduleId: 'm3', lessonId: 'm3l2', occurrences: [], connections: [] },
  { id: 't-m3l2-4', name: 'Триггер', status: 'ready', definition: 'Автоматически выполняемая процедура в БД.', moduleId: 'm3', lessonId: 'm3l2', occurrences: [], connections: [] },
  { id: 't-m3l2-5', name: 'Фильтр', status: 'in-progress', definition: '', moduleId: 'm3', lessonId: 'm3l2', occurrences: [], connections: [] },
];

// ============================================================
// COURSES
// ============================================================
export const mockCourses: Course[] = [
  {
    id: 'c1',
    name: 'Интерактивный тренажер по SQL',
    url: 'https://stepik.org/course/63054',
    lastImportDate: '15.05.2026',
    glossaries: [
      {
        id: 'g1',
        name: 'Глоссарий SQL — Основной',
        courseId: 'c1',
        terms: [
          ...termsM1L1, ...termsM1L2, ...termsM2L1, ...termsM2L2, ...termsM3L1, ...termsM3L2,
        ],
      },
      {
        id: 'g2',
        name: 'Глоссарий SQL — Продвинутый',
        courseId: 'c1',
        terms: [],
      },
    ],
    modules: [
      {
        id: 'm1', name: 'Модуль 1. Основы реляционной модели и SQL', courseId: 'c1',
        lessons: [
          { id: 'm1l1', name: 'Урок 1.1. Отношение (таблица)', moduleId: 'm1', steps: [
            { id: 's1', name: 'Шаг 1. Понятие алгоритма', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's2', name: 'Шаг 2. Свойства алгоритмов', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's3', name: 'Шаг 3. Введение в БД', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's4', name: 'Шаг 4. Метафоры', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's5', name: 'Шаг 5. Пользователи', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's6', name: 'Шаг 6. Разбиение задач', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's7', name: 'Шаг 7. SQL-запросы', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's8', name: 'Шаг 8. Выборка данных', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
            { id: 's9', name: 'Шаг 9. Логические операции', lessonId: 'm1l1', moduleId: 'm1', content: '...', ftsIndexed: true },
          ]},
          { id: 'm1l2', name: 'Урок 1.2. Создание таблиц', moduleId: 'm1', steps: [] },
          { id: 'm1l3', name: 'Урок 1.3. Типы данных', moduleId: 'm1', steps: [] },
          { id: 'm1l4', name: 'Урок 1.4. Вложенные запросы', moduleId: 'm1', steps: [] },
          { id: 'm1l5', name: 'Урок 1.5. Агрегатные функции', moduleId: 'm1', steps: [] },
          { id: 'm1l6', name: 'Урок 1.6. Группировка', moduleId: 'm1', steps: [] },
        ],
      },
      {
        id: 'm2', name: 'Модуль 2. Работа с данными', courseId: 'c1',
        lessons: [
          { id: 'm2l1', name: 'Урок 2.1. SELECT-запросы', moduleId: 'm2', steps: [] },
          { id: 'm2l2', name: 'Урок 2.2. UPDATE и DELETE', moduleId: 'm2', steps: [] },
          { id: 'm2l3', name: 'Урок 2.3. Индексы', moduleId: 'm2', steps: [] },
          { id: 'm2l4', name: 'Урок 2.4. Представления', moduleId: 'm2', steps: [] },
          { id: 'm2l5', name: 'Урок 2.5. Хранимые процедуры', moduleId: 'm2', steps: [] },
        ],
      },
      {
        id: 'm3', name: 'Модуль 3. Задачи и проекты', courseId: 'c1',
        lessons: [
          { id: 'm3l1', name: 'Урок 3.1. Соединение таблиц', moduleId: 'm3', steps: [] },
          { id: 'm3l2', name: 'Урок 3.2. Подзапросы', moduleId: 'm3', steps: [] },
          { id: 'm3l3', name: 'Урок 3.3. Оконные функции', moduleId: 'm3', steps: [] },
          { id: 'm3l4', name: 'Урок 3.4. Транзакции', moduleId: 'm3', steps: [] },
          { id: 'm3l5', name: 'Урок 3.5. Проектная работа', moduleId: 'm3', steps: [] },
        ],
      },
    ],
  },
  {
    id: 'c2',
    name: 'Введение в Python',
    url: 'https://stepik.org/course/67',
    lastImportDate: null,
    glossaries: [
      {
        id: 'g3',
        name: 'Глоссарий Python',
        courseId: 'c2',
        terms: [],
      },
    ],
    modules: [],
  },
];

// ============================================================
// GRAPH DATA — Module Level
// ============================================================
export const moduleGraphNodes: GraphNode[] = [
  { id: 'm1', name: 'Модуль 1\nОсновы SQL', type: 'module' },
  { id: 'm2', name: 'Модуль 2\nРабота с данными', type: 'module' },
  { id: 'm3', name: 'Модуль 3\nЗадачи и проекты', type: 'module' },
];

export const moduleGraphLinks: GraphLink[] = [
  { source: 'm1', target: 'm2', type: 'mention', weight: 8 },
  { source: 'm2', target: 'm3', type: 'mention', weight: 12 },
  { source: 'm1', target: 'm3', type: 'first-appearance', weight: 5 },
];

// Graph data for lessons inside Module 1
export const lessonGraphNodesM1: GraphNode[] = [
  { id: 'm1l1', name: 'Урок 1.1\nОтношение', type: 'lesson', parentId: 'm1' },
  { id: 'm1l2', name: 'Урок 1.2\nСоздание таблиц', type: 'lesson', parentId: 'm1' },
  { id: 'm1l3', name: 'Урок 1.3\nТипы данных', type: 'lesson', parentId: 'm1' },
  { id: 'm1l4', name: 'Урок 1.4\nВложенные запросы', type: 'lesson', parentId: 'm1' },
  { id: 'm1l5', name: 'Урок 1.5\nАгрегатные функции', type: 'lesson', parentId: 'm1' },
  { id: 'm1l6', name: 'Урок 1.6\nГруппировка', type: 'lesson', parentId: 'm1' },
];

export const lessonGraphLinksM1: GraphLink[] = [
  { source: 'm1l1', target: 'm1l2', type: 'first-appearance', weight: 6 },
  { source: 'm1l2', target: 'm1l3', type: 'mention', weight: 4 },
  { source: 'm1l3', target: 'm1l4', type: 'first-appearance', weight: 7 },
  { source: 'm1l4', target: 'm1l5', type: 'mention', weight: 3 },
  { source: 'm1l5', target: 'm1l6', type: 'first-appearance', weight: 5 },
  { source: 'm1l1', target: 'm1l4', type: 'mention', weight: 2 },
  { source: 'm1l2', target: 'm1l5', type: 'mention', weight: 3 },
];

// Graph data for terms inside Lesson 1.1
export const termGraphNodesL1: GraphNode[] = [
  { id: 'center-m1l1', name: 'Урок 1.1\nОтношение', type: 'lesson', parentId: 'm1l1' },
  ...termsM1L1.map(t => ({ id: t.id, name: t.name, type: 'term' as const, status: t.status, parentId: 'm1l1' })),
];

export const termGraphLinksL1: GraphLink[] = termsM1L1.map((t, i) => ({
  source: 'center-m1l1',
  target: t.id,
  type: (i % 2 === 0 ? 'first-appearance' : 'mention') as LinkType,
  weight: 1 + (i % 3),
}));

// Export all terms flat for the glossary panel
export const allTerms = [
  ...termsM1L1, ...termsM1L2,
  ...termsM2L1, ...termsM2L2,
  ...termsM3L1, ...termsM3L2,
];
