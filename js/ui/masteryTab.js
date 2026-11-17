// 掌握 Tab：三态总览 + 状态管理 + 已掌握归档区
window.SAT = window.SAT || {};

SAT.masteryTab = {
    state: {
        filter: 'all',        // all | 未掌握 | 掌握中 | 已掌握
        keyword: '',
        archiveOpen: false,   // 归档区展开
        showAll: false        // 列表截断开关
    },

    // 列表视图：词条 + 状态 + 释义查找
    listView(bookDataMap) {
        // bookDataMap: {word -> {meaning, english, unit, bookId}}
        const st = this.state;
        const kw = st.keyword.trim().toLowerCase();
        let items = Object.keys(bookDataMap).map(w => ({
            word: w,
            status: SAT.statusStore.get(w),
            meta: bookDataMap[w]
        }));
        if (st.filter !== 'all') items = items.filter(i => i.status === st.filter);
        if (kw) items = items.filter(i =>
            i.word.toLowerCase().includes(kw) ||
            (i.meta.meaning || '').toLowerCase().includes(kw));
        return items;
    },

    archivedList(bookDataMap) {
        return Object.keys(bookDataMap)
            .filter(w => SAT.statusStore.get(w) === '已掌握')
            .map(w => ({ word: w, meta: bookDataMap[w] }));
    }
};
