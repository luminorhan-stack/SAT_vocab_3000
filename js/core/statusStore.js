// 掌握状态管理：未掌握 / 掌握中 / 已掌握（参考 complete the words 三态模型）
window.SAT = window.SAT || {};

SAT.STATUS = ['未掌握', '掌握中', '已掌握'];
SAT.STATUS_ICON = { '未掌握': '🔴', '掌握中': '🟡', '已掌握': '🟢' };

SAT.statusStore = {
    // 内存态（响应式由 app 层包裹）
    _map: {},   // { word: {status, updatedAt, bookId, unit} }

    init() {
        this._map = SAT.migrateLegacy();
    },

    raw() { return this._map; },

    get(word) {
        return (this._map[word] && this._map[word].status) || '未掌握';
    },

    set(word, status, bookId, unit) {
        if (SAT.STATUS.indexOf(status) < 0) status = '未掌握';
        this._map[word] = {
            status: status,
            updatedAt: SAT.todayStr(),
            bookId: bookId || '',
            unit: unit || ''
        };
        this.save();
    },

    // 循环切换：未掌握 -> 掌握中 -> 已掌握 -> 未掌握
    cycle(word, bookId, unit) {
        const cur = this.get(word);
        const next = SAT.STATUS[(SAT.STATUS.indexOf(cur) + 1) % 3];
        this.set(word, next, bookId, unit);
        return next;
    },

    // 学习流程中的答题联动：
    //  答对 -> 至少 掌握中；答错 -> 回落 未掌握
    applyAnswer(word, isCorrect, bookId, unit) {
        const cur = this.get(word);
        if (isCorrect) {
            if (cur !== '已掌握') this.set(word, '掌握中', bookId, unit);
        } else {
            this.set(word, '未掌握', bookId, unit);
        }
    },

    // 归档 = 已掌握单词集合
    archived() {
        return Object.keys(this._map)
            .filter(w => this._map[w].status === '已掌握')
            .sort();
    },

    counts() {
        const c = { '未掌握': 0, '掌握中': 0, '已掌握': 0 };
        Object.keys(this._map).forEach(w => { c[this._map[w].status]++; });
        return c;
    },

    save() {
        SAT.store.set(SAT.K.MASTERY, this._map);
    }
};
