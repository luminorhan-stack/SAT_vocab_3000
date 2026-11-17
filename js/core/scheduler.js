// 艾宾浩斯复习调度器
// 间隔序列（天）：0, 1, 2, 4, 7, 15, 30
// 单词在"新词任务完成"后进入复习链，复习轮次对应偏移 EB[1..6]：
// 学后第 1/2/4/7/15/30 天各一轮，共 6 轮。全部完成视为走完复习链。
window.SAT = window.SAT || {};

SAT.EB = [0, 1, 2, 4, 7, 15, 30]; // EB[0]=0 为学习日当天，不作为复习轮

SAT.scheduler = {

    // 词书单元的稳定顺序（保持教材顺序，不做排序）
    bookWordList(bookData) {
        const out = [];
        Object.keys(bookData).forEach(u => {
            (bookData[u] || []).forEach(w => out.push({ word: w.word, unit: u }));
        });
        return out;
    },

    planDays(plan, totalWords) {
        const per = Math.max(1, parseInt(plan.perDay, 10) || 1);
        return Math.ceil(totalWords / per);
    },

    // 某日期应学的新词切片 [start, end)
    newSliceFor(plan, totalWords, dateStr) {
        const diff = SAT.daysBetween(plan.startDate, dateStr);
        if (diff == null || diff < 0) return { start: -1, end: -1 };
        const per = Math.max(1, parseInt(plan.perDay, 10) || 1);
        const start = diff * per;
        if (start >= totalWords) return { start: -1, end: -1 };
        return { start: start, end: Math.min(start + per, totalWords) };
    },

    // 生成某一天的完整任务清单
    // -> { date, newWords:[{word,unit}], reviews:[{word,unit,stage,dueDate,completed}], over }
    tasksFor(plan, bookData, progress, dateStr) {
        const words = this.bookWordList(bookData);
        const total = words.length;
        const per = Math.max(1, parseInt(plan.perDay, 10) || 1);
        const days = (progress && progress.days) || {};
        const rcMap = (progress && progress.reviewCount) || {};
        const diff = SAT.daysBetween(plan.startDate, dateStr);
        const result = { date: dateStr, newWords: [], reviews: [], over: false };

        if (diff != null && diff >= 0) {
            // 新词
            const slice = this.newSliceFor(plan, total, dateStr);
            if (slice.start >= 0) {
                for (let i = slice.start; i < slice.end; i++) result.newWords.push(words[i]);
            } else {
                result.over = diff > 0; // 新词全部学完
            }

            // 复习：遍历 [0..diff] 每个学习日的新词，学完(done)的词进入复习链
            const totalStages = SAT.EB.length - 1; // 6 轮
            for (let d = 0; d <= diff; d++) {
                const s = d * per, e = Math.min(s + per, total);
                if (s >= total) break;
                const rec = days[SAT.dateAdd(plan.startDate, d)] || {};
                const done = rec.done || {};
                for (let i = s; i < e; i++) {
                    const item = words[i];
                    if (!done[item.word]) continue;        // 新词未学，不派发复习
                    const rc = rcMap[item.word] || 0;
                    if (rc >= totalStages) continue;        // 复习链已完成
                    for (let st = 1; st <= totalStages; st++) {
                        const dueDay = d + SAT.EB[st];
                        if (dueDay <= diff) {
                            result.reviews.push({
                                word: item.word,
                                unit: item.unit,
                                stage: st,
                                dueDate: SAT.dateAdd(plan.startDate, dueDay),
                                completed: rc >= st
                            });
                        }
                    }
                }
            }
        } else {
            result.over = true; // 计划尚未开始
        }
        return result;
    },

    todayTasks(plan, bookData, progress) {
        return this.tasksFor(plan, bookData, progress, SAT.todayStr());
    }
};
