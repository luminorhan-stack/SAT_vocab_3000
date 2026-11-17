// localStorage 封装 + 旧数据兼容迁移
window.SAT = window.SAT || {};

SAT.K = { // 键名常量（沿用原版键名，保证旧数据直接兼容）
    AUTH: 'lumi_auth',
    MODE: 'sat_vocab_mode',
    CUSTOM: 'sat_custom_data',
    WRONGS: 'sat_wrongs',
    LOGS: 'exam_logs',
    // v2 新增
    MASTERY: 'sat_mastery_v2',      // { "word": {status, updatedAt, bookId, unit} }
    PLAN: 'sat_plan_v2',            // 背词计划配置
    PROGRESS: 'sat_progress_v2',    // 每日任务完成进度
    ANSWERS: 'sat_answer_logs_v2'   // 词级答题记录（按日聚合 + 错误计数 + 单元统计）
};

SAT.store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    },
    set(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); }
        catch (e) { console.warn('localStorage 写入失败', key, e); }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* noop */ }
    },
    getRaw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    setRaw(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* noop */ } }
};

// ============ 掌握状态：旧数据迁移 ============
// 迁移规则（一次性，幂等）：
//  1. sat_mastery_v2 不存在时初始化为 {}
//  2. 旧 sat_wrongs 中存在的词 -> 未掌握（曾在错题本 = 明确没掌握）
//  3. 其余所有词默认视为"未接触"，同样记为 未掌握 状态的初始值
//     （区分"未接触"与"未掌握"意义不大，三态模型以 未掌握 为起点）
SAT.migrateLegacy = function () {
    const m = SAT.store.get(SAT.K.MASTERY, null);
    if (m !== null && typeof m === 'object') return m; // 已初始化

    const mastery = {};
    const wrongs = SAT.store.get(SAT.K.WRONGS, []);
    (wrongs || []).forEach(w => {
        if (w && w.word) {
            mastery[w.word] = { status: '未掌握', updatedAt: SAT.todayStr(), from: 'legacy-wrong' };
        }
    });
    SAT.store.set(SAT.K.MASTERY, mastery);
    return mastery;
};

// ============ 计划数据：结构版本与升级 ============
SAT.loadPlan = function () {
    const p = SAT.store.get(SAT.K.PLAN, null);
    if (!p || typeof p !== 'object' || !p.version) return null;
    if (p.version === 1) return p;
    return p; // 未知版本原样返回，由调用方兜底
};

SAT.savePlan = function (plan) {
    SAT.store.set(SAT.K.PLAN, plan);
};

SAT.loadProgress = function () {
    const p = SAT.store.get(SAT.K.PROGRESS, null);
    if (!p || typeof p !== 'object' || !p.version) return { version: 1, days: {} };
    if (!p.days || typeof p.days !== 'object') p.days = {};
    return p;
};

SAT.saveProgress = function (prog) {
    SAT.store.set(SAT.K.PROGRESS, prog);
};

// ============ 全量备份 / 恢复（方案 1） ============
// 说明：raw 存取（不经 JSON.parse/stringify），兼容原版的裸字符串键
//（lumi_auth='true'、sat_vocab_mode='3000'）与 v2 的 JSON 键，均无损往返。
SAT.backup = {
    APP_ID: 'lumi-sat-vocab-pro',

    // 打包全部业务键 -> 可下载的 JSON 对象
    exportAll() {
        const data = {};
        Object.keys(SAT.K).forEach(name => {
            const raw = SAT.store.getRaw(SAT.K[name]);
            if (raw != null) data[SAT.K[name]] = raw;
        });
        return {
            app: this.APP_ID,
            type: 'full-backup',
            schemaVersion: 2,
            exportedAt: new Date().toISOString(),
            data: data
        };
    },

    // 校验备份文件结构；通过返回 data 映射，失败返回 null
    parse(payload) {
        if (!payload || typeof payload !== 'object') return null;
        if (payload.app !== this.APP_ID || !payload.data || typeof payload.data !== 'object') return null;
        return payload.data;
    },

    // 覆盖式恢复：只写备份中存在的键，其他键保持不动；返回恢复的键数量
    restore(dataMap) {
        let n = 0;
        Object.keys(dataMap).forEach(k => {
            SAT.store.setRaw(k, dataMap[k]);
            n++;
        });
        return n;
    }
};
