// planTab：计划页视图计算（配置表单 + 按日任务视图）
window.SAT = window.SAT || {};

SAT.planTab = {

    // 某日任务及完成态合并视图
    dayView(plan, progress, offset) {
        const dateStr = SAT.dateAdd(SAT.todayStr(), offset);
        const book = SAT.BOOKS[plan.bookId];
        const data = plan.bookId && plan.bookId.indexOf('custom:') === 0
            ? SAT.planTab.customBookData(plan.bookId)
            : (book ? book.data() : {});
        const tasks = SAT.scheduler.tasksFor(plan, data, progress, dateStr);
        return {
            date: dateStr,
            isToday: offset === 0,
            tasks: tasks,
            newDone: tasks.newWords.filter(w => this.isNewDone(progress, tasks.date, w.word)),
            newUndone: tasks.newWords.filter(w => !this.isNewDone(progress, tasks.date, w.word)),
            revDone: tasks.reviews.filter(r => r.completed),
            revUndone: tasks.reviews.filter(r => !r.completed),
            totalDays: SAT.scheduler.planDays(plan, SAT.scheduler.bookWordList(data).length)
        };
    },

    isNewDone(progress, dateStr, word) {
        const rec = ((progress.days || {})[dateStr] || {});
        return !!(rec.done && rec.done[word]);
    },

    // 自定义词书数据 {unit: [words]}
    customBookData(customId) {
        const unit = String(customId).replace(/^custom:/, '');
        const savedCustom = SAT.store.get(SAT.K.CUSTOM, {});
        return savedCustom[unit] ? { [unit]: savedCustom[unit] } : {};
    }
};
