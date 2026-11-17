// 核心工具与命名空间
window.SAT = window.SAT || {};

SAT.todayStr = function () {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

SAT.parseDate = function (str) {
    // 'YYYY-MM-DD' -> 本地零点 Date；非法返回 null
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
};

SAT.dateAdd = function (str, days) {
    const d = SAT.parseDate(str);
    if (!d) return null;
    d.setDate(d.getDate() + days);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

SAT.daysBetween = function (a, b) {
    // b - a，按日历日计算（忽略时分秒）
    const da = SAT.parseDate(a), db = SAT.parseDate(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
};

SAT.fmtCN = function (str) {
    // '2026-11-17' -> '2026/11/17'
    return String(str || '').replace(/-/g, '/');
};

SAT.weekdayCN = function (str) {
    const d = SAT.parseDate(str);
    if (!d) return '';
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
};

SAT.esc = function (s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
