// 词书注册表：三大内置词书 + 自定义词库
// 数据文件: data3000.js / data700.js / data1600.js（原样提取，未改动）
window.SAT = window.SAT || {};

SAT.BOOKS = {
    '3000': {
        id: '3000',
        name: 'SAT 3000 词',
        sub: 'SAT Core',
        icon: '📚',
        theme: 'theme-3000',
        accent: 'indigo',
        desc: '4209 个单词 · 41 个单元',
        data: function () { return window.data3000; }
    },
    '700': {
        id: '700',
        name: '卓越班 700 词',
        sub: 'Excellence Class',
        icon: '⭐',
        theme: 'theme-700',
        accent: 'amber',
        desc: '778 个单词 · 11 个单元',
        data: function () { return window.data700; }
    },
    '1600': {
        id: '1600',
        name: '机考核心 1600 词',
        sub: 'SAT Reading Core',
        icon: '📖',
        theme: 'theme-1600',
        accent: 'green',
        desc: '1425 个单词 · 51 个 List',
        data: function () { return window.data1600; }
    }
};
