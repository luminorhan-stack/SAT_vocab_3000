// 词级答题记录：按日聚合统计 + 累计错误计数 + 单元正确率
// 存储设计（4000 词量级下的压缩策略）：
//   days:     按日只存 total/correct 两个计数，不存词明细
//   wrongCount: 仅答错的词累计次数（高危词排行）
//   perUnit:  单元级 total/wrong 聚合（薄弱单元排行）
window.SAT = window.SAT || {};

SAT.answerLog = {
    _data: null,

    _empty() {
        return { version: 1, days: {}, wrongCount: {}, perUnit: {} };
    },

    init() {
        const d = SAT.store.get(SAT.K.ANSWERS, null);
        this._data = (d && typeof d === 'object' && d.days) ? d : this._empty();
    },

    raw() { return this._data; },

    // 每次答题调用：unit 查不到时仅计入当日统计
    record(word, isCorrect, unit) {
        if (!this._data) this.init();
        const d = SAT.todayStr();
        const day = this._data.days[d] = this._data.days[d] || { total: 0, correct: 0 };
        day.total++;
        if (isCorrect) day.correct++;

        if (!isCorrect && word) {
            this._data.wrongCount[word] = (this._data.wrongCount[word] || 0) + 1;
        }
        if (unit) {
            const pu = this._data.perUnit[unit] = this._data.perUnit[unit] || { total: 0, wrong: 0 };
            pu.total++;
            if (!isCorrect) pu.wrong++;
        }
        this.save();
    },

    save() { SAT.store.set(SAT.K.ANSWERS, this._data); },

    // 近 n 天序列：[{date, total, correct, wrong}]
    lastNDays(n) {
        const out = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = SAT.dateAdd(SAT.todayStr(), -i);
            const day = (this._data.days || {})[d] || { total: 0, correct: 0 };
            out.push({ date: d, total: day.total, correct: day.correct, wrong: day.total - day.correct });
        }
        return out;
    },

    // 薄弱单元：total >= minTotal，按错误率降序
    weakUnits(minTotal, topN) {
        const pu = this._data.perUnit || {};
        return Object.keys(pu)
            .map(u => {
                const total = pu[u].total, wrong = pu[u].wrong;
                return { unit: u, total: total, wrong: wrong, rate: total ? Math.round(wrong / total * 100) : 0 };
            })
            .filter(x => x.total >= minTotal && x.wrong > 0)
            .sort((a, b) => b.rate - a.rate || b.wrong - a.wrong)
            .slice(0, topN);
    },

    // 高危词：累计答错 >= minWrong，降序
    dangerWords(minWrong, topN) {
        const wc = this._data.wrongCount || {};
        return Object.keys(wc)
            .filter(w => wc[w] >= minWrong)
            .map(w => ({ word: w, count: wc[w] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, topN);
    }
};
