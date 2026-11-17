// planStore：背词计划配置的读写与校验
window.SAT = window.SAT || {};

SAT.planStore = {
    // 默认计划：null = 未创建
    defaults() {
        return {
            version: 1,
            bookId: '3000',
            perDay: 20,
            startDate: SAT.todayStr(),
            createdAt: new Date().toISOString()
        };
    },

    load() {
        const p = SAT.loadPlan();
        if (!p) return null;
        // 兜底校验
        if (!SAT.BOOKS[p.bookId]) p.bookId = '3000';
        if (!(parseInt(p.perDay, 10) > 0)) p.perDay = 20;
        if (!SAT.parseDate(p.startDate)) p.startDate = SAT.todayStr();
        return p;
    },

    save(plan) {
        plan.version = 1;
        plan.updatedAt = new Date().toISOString();
        SAT.savePlan(plan);
    },

    clear() {
        SAT.store.remove(SAT.K.PLAN);
        SAT.store.remove(SAT.K.PROGRESS);
    }
};
