// SAT 词汇检测系统Pro v2 主应用
// 原有功能全量保留：密码 / 词库选择 / 练习 / 抽测 / 自选 / 闪卡 / 错题本 / 看板 / CSV 导入
// v2 新增：艾宾浩斯背词计划 + 三态掌握状态 + 归档管理
(function () {
    const { createApp, ref, computed, onMounted } = Vue;

    createApp({
        setup() {
            /* ================= 认证（原样保留） ================= */
            const isAuthorized = ref(false);
            const passInput = ref('');
            const checkPass = () => {
                if (passInput.value === 'lumilumi') {
                    isAuthorized.value = true;
                    localStorage.setItem('lumi_auth', 'true');
                } else { alert('密码错误，请重试'); }
            };

            /* ================= 词库选择（原样保留） ================= */
            const vocabMode = ref(null);
            const booksMeta = SAT.BOOKS;

            function selectVocab(mode) {
                vocabMode.value = mode;
                localStorage.setItem('sat_vocab_mode', mode);
                rebuildAllData();
                tab.value = 'home';
                flashUnit.value = sortedUnits.value[0] || '';
                flashIdx.value = 0;
            }
            function switchVocab() {
                if (isTesting.value || showResult.value) return;
                vocabMode.value = null;
                localStorage.removeItem('sat_vocab_mode');
            }

            /* ================= 数据装配（原样保留） ================= */
            const allData = ref({});
            function currentBaseData() {
                const b = SAT.BOOKS[vocabMode.value];
                return b ? b.data() : {};
            }
            function rebuildAllData() {
                let result = {};
                Object.keys(currentBaseData()).forEach(k => { result[k] = currentBaseData()[k]; });
                const savedCustom = SAT.store.get(SAT.K.CUSTOM, {});
                Object.keys(savedCustom).forEach(k => { result[k] = savedCustom[k]; });
                allData.value = result;
            }

            /* ================= 原有测试流程状态 ================= */
            const tab = ref('home'); const isTesting = ref(false); const isExamMode = ref(false);
            const isWrongTestMode = ref(false);
            const idx = ref(0); const testList = ref([]); const opts = ref([]);
            const answered = ref(false); const sel = ref(null); const correctCount = ref(0);
            const showResult = ref(false); const showAdmin = ref(false);

            const sortedUnits = computed(() => Object.keys(allData.value).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
            const flashUnit = ref('');
            const flashIdx = ref(0);
            const isFlipped = ref(false);
            const flashList = computed(() => allData.value[flashUnit.value] || []);
            const wrongs = ref(SAT.store.get(SAT.K.WRONGS, []));
            const examLogs = ref(SAT.store.get(SAT.K.LOGS, []));

            const totalTests = computed(() => examLogs.value.length);
            const averageScore = computed(() => {
                if (examLogs.value.length === 0) return 0;
                let sum = examLogs.value.reduce((acc, c) => acc + c.score, 0);
                return Math.round(sum / examLogs.value.length);
            });

            const selectedUnits = ref([]);
            const customCount = ref(20);
            const unitsToDelete = ref([]);

            const customUnits = computed(() => {
                const saved = SAT.store.get(SAT.K.CUSTOM, {});
                return Object.keys(saved).sort();
            });

            const levelGroups = computed(() => {
                let g = {};
                Object.keys(allData.value).forEach(k => {
                    if (vocabMode.value === '700') {
                        if (k.startsWith('E') && k.match(/^E[U\d]/)) {
                            if (!g['卓越班']) g['卓越班'] = [];
                            g['卓越班'].push(k);
                        } else { (g['Custom'] = g['Custom'] || []).push(k); }
                    } else if (vocabMode.value === '1600') {
                        if (k.match(/^List\s/)) {
                            if (!g['机考核心']) g['机考核心'] = [];
                            g['机考核心'].push(k);
                        } else { (g['Custom'] = g['Custom'] || []).push(k); }
                    } else {
                        let m = k.match(/L(\d+)/);
                        if (m) { const lv = m[1]; (g[lv] = g[lv] || []).push(k); }
                        else { (g['Custom'] = g['Custom'] || []).push(k); }
                    }
                });
                Object.keys(g).forEach(lv => g[lv].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
                return g;
            });

            const curr = computed(() => testList.value[idx.value] || {});
            const finalScore = computed(() => testList.value.length ? Math.round((correctCount.value / testList.value.length) * 100) : 0);

            const isCurrentInWrongs = computed(() => {
                if (!flashList.value.length) return false;
                const cur = flashList.value[flashIdx.value];
                return wrongs.value.some(w => w.word === cur.word);
            });

            function toggleFlashcardWrong() {
                if (!flashList.value.length) return;
                const cur = flashList.value[flashIdx.value];
                const i = wrongs.value.findIndex(w => w.word === cur.word);
                if (i !== -1) wrongs.value.splice(i, 1);
                else wrongs.value.unshift(cur);
                SAT.store.set(SAT.K.WRONGS, wrongs.value);
            }

            /* ================= v2：掌握状态 ================= */
            const statusTick = ref(0); // 手动触发依赖状态刷新
            const bookWordMap = computed(() => {
                void statusTick.value;
                const m = {};
                Object.keys(allData.value).forEach(u => {
                    (allData.value[u] || []).forEach(w => { m[w.word] = { meaning: w.meaning, english: w.english, unit: u }; });
                });
                return m;
            });
            // 全局词条映射（跨词书 + 自定义，供答题记录/高危词显示用）
            const globalWordMeta = computed(() => {
                void statusTick.value;
                const m = {};
                Object.keys(SAT.BOOKS).forEach(bid => {
                    const d = SAT.BOOKS[bid].data();
                    Object.keys(d).forEach(u => (d[u] || []).forEach(w => {
                        if (!m[w.word]) m[w.word] = { meaning: w.meaning, english: w.english, unit: u, bookId: bid };
                    }));
                });
                const custom = SAT.store.get(SAT.K.CUSTOM, {});
                Object.keys(custom).forEach(u => (custom[u] || []).forEach(w => {
                    if (!m[w.word]) m[w.word] = { meaning: w.meaning, english: w.english, unit: u, bookId: 'custom' };
                }));
                return m;
            });
            const wordMetaOf = (w) => globalWordMeta.value[w] || null;
            const statusOf = (w) => { void statusTick.value; return SAT.statusStore.get(w); };
            const statusCounts = computed(() => {
                void statusTick.value;
                return SAT.statusStore.counts();
            });
            function cycleStatus(word) {
                SAT.statusStore.cycle(word, vocabMode.value, (bookWordMap.value[word] || {}).unit);
                statusTick.value++;
            }
            function setStatus(word, st) {
                SAT.statusStore.set(word, st, vocabMode.value, (bookWordMap.value[word] || {}).unit);
                statusTick.value++;
            }

            /* ================= v2：背词计划 ================= */
            const plan = ref(SAT.planStore.load());
            const progress = ref(SAT.loadProgress());
            const planEditing = ref(false);
            const planForm = ref({ bookId: '3000', perDay: 20, startDate: SAT.todayStr() });
            const planError = ref('');
            const dayOffset = ref(0);
            const planBookList = ref([]); // 计划可选词书（内置 + 自定义）

            function refreshPlanBookOptions() {
                const list = Object.keys(SAT.BOOKS).map(id => ({
                    id: id, label: SAT.BOOKS[id].name + '（' + SAT.BOOKS[id].desc + '）'
                }));
                const savedCustom = SAT.store.get(SAT.K.CUSTOM, {});
                Object.keys(savedCustom).sort().forEach(u => {
                    list.push({ id: 'custom:' + u, label: '自定义 · ' + u + '（' + savedCustom[u].length + ' 词）' });
                });
                planBookList.value = list;
            }

            function planBookData() {
                if (!plan.value) return {};
                const id = plan.value.bookId;
                if (id && id.indexOf('custom:') === 0) {
                    const unit = id.slice(7);
                    const savedCustom = SAT.store.get(SAT.K.CUSTOM, {});
                    return savedCustom[unit] ? { [unit]: savedCustom[unit] } : {};
                }
                return SAT.BOOKS[id] ? SAT.BOOKS[id].data() : {};
            }

            function openPlanForm() {
                refreshPlanBookOptions();
                if (plan.value) {
                    planForm.value = { bookId: plan.value.bookId, perDay: plan.value.perDay, startDate: plan.value.startDate };
                } else {
                    planForm.value = { bookId: vocabMode.value || '3000', perDay: 20, startDate: SAT.todayStr() };
                }
                planError.value = '';
                planEditing.value = true;
            }

            function savePlanForm() {
                const f = planForm.value;
                const perDay = parseInt(f.perDay, 10);
                if (!f.bookId) { planError.value = '请选择词书'; return; }
                if (!(perDay >= 5 && perDay <= 200)) { planError.value = '每日新词量需在 5-200 之间'; return; }
                if (!SAT.parseDate(f.startDate)) { planError.value = '开始日期无效'; return; }
                plan.value = { version: 1, bookId: f.bookId, perDay: perDay, startDate: f.startDate };
                SAT.planStore.save(plan.value);
                planEditing.value = false;
                planError.value = '';
                dayOffset.value = 0;
            }

            function deletePlan() {
                if (!confirm('确定删除背词计划？计划与每日完成进度将一并清除（掌握状态与错题本保留）。')) return;
                SAT.planStore.clear();
                plan.value = null;
                progress.value = SAT.loadProgress();
                dayOffset.value = 0;
            }

            const todayView = computed(() => {
                if (!plan.value) return null;
                return SAT.planTab.dayView(plan.value, progress.value, 0);
            });

            // 今日完成率（新词 + 复习合并计算）
            const todayDoneRatio = computed(() => {
                const tv = todayView.value;
                if (!tv) return 0;
                const total = tv.tasks.newWords.length + tv.tasks.reviews.length;
                const done = tv.newDone.length + tv.revDone.length;
                return total ? done / total : 1;
            });

            const dayView = computed(() => {
                if (!plan.value) return null;
                const off = Math.max(-60, Math.min(60, dayOffset.value));
                return SAT.planTab.dayView(plan.value, progress.value, off);
            });

            function scheduledDateFor(word) {
                const data = planBookData();
                const list = SAT.scheduler.bookWordList(data);
                const per = Math.max(1, parseInt(plan.value.perDay, 10) || 1);
                const i = list.findIndex(x => x.word === word);
                if (i < 0) return null;
                return SAT.dateAdd(plan.value.startDate, Math.floor(i / per));
            }

            function toggleNewTask(word) {
                const d = scheduledDateFor(word) || SAT.todayStr();
                const days = progress.value.days = progress.value.days || {};
                if (!days[d]) days[d] = { done: {}, reviewDone: {} };
                days[d].done = days[d].done || {};
                days[d].done[word] = !days[d].done[word];
                SAT.saveProgress(progress.value);
            }

            function toggleReviewTask(word) {
                const d = SAT.todayStr();
                const days = progress.value.days = progress.value.days || {};
                if (!days[d]) days[d] = { done: {}, reviewDone: {} };
                const rec = days[d];
                rec.reviewDone = rec.reviewDone || {};
                const rc = progress.value.reviewCount = progress.value.reviewCount || {};
                if (rec.reviewDone[word]) {
                    rec.reviewDone[word] = false;
                    if (rc[word] > 0) rc[word]--;
                } else {
                    rec.reviewDone[word] = true;
                    rc[word] = (rc[word] || 0) + 1;
                    // 复习链走完 → 自动晋升已掌握（进入归档）
                    if (rc[word] >= SAT.EB.length && SAT.statusStore.get(word) !== '已掌握') {
                        SAT.statusStore.set(word, '已掌握', plan.value.bookId, (bookWordMap.value[word] || {}).unit);
                        statusTick.value++;
                    }
                }
                SAT.saveProgress(progress.value);
            }

            function isNewTaskDone(dateStr, word) {
                const rec = (progress.value.days || {})[dateStr];
                return !!(rec && rec.done && rec.done[word]);
            }
            function isReviewDone(dateStr, word) {
                const rec = (progress.value.days || {})[dateStr];
                return !!(rec && rec.reviewDone && rec.reviewDone[word]);
            }

            /* ================= 测试流程（含 v2 集成） ================= */
            const testContext = ref(null); // {source:'plan', type:'new'|'review'}
            const answerMap = ref({});     // 本轮测试 word -> 是否答对

            function startTest(u, isExam) {
                isExamMode.value = isExam;
                isWrongTestMode.value = false;
                testContext.value = null;
                let pool = [...allData.value[u]];
                // v2.1 方案2：抽测默认排除已掌握（归档）词
                if (isExam && filterMastered.value) {
                    pool = pool.filter(w => SAT.statusStore.get(w.word) !== '已掌握');
                    if (!pool.length) return alert('该单元单词已全部归档（🟢 已掌握）！\n可在词库页关闭「抽测智能过滤」后进行全量抽测。');
                }
                let full = pool.sort(() => Math.random() - 0.5);
                testList.value = isExam ? full.slice(0, 20) : full;
                beginTest();
            }

            function startCustomTest() {
                if (selectedUnits.value.length === 0) return alert('请至少勾选一个单元哦！');
                let pool = [];
                selectedUnits.value.forEach(u => { if (allData.value[u]) pool = pool.concat(allData.value[u]); });
                if (filterMastered.value) {
                    pool = pool.filter(w => SAT.statusStore.get(w.word) !== '已掌握');
                    if (!pool.length) return alert('所选单元的单词已全部归档（🟢 已掌握）！\n可关闭「抽测智能过滤」后重新检测。');
                }
                let count = parseInt(customCount.value);
                if (isNaN(count) || count <= 0) count = 20;
                if (count > pool.length) count = pool.length;
                pool.sort(() => Math.random() - 0.5);
                testList.value = pool.slice(0, count);
                isExamMode.value = true;
                isWrongTestMode.value = false;
                testContext.value = null;
                beginTest();
            }

            function startWrongTest() {
                if (wrongs.value.length === 0) return;
                isExamMode.value = true;
                isWrongTestMode.value = true;
                testContext.value = null;
                testList.value = [...wrongs.value].sort(() => Math.random() - 0.5);
                beginTest();
            }

            // 计划任务测试：type = 'new' | 'review'
            function startPlanTest(type) {
                const dv = SAT.planTab.dayView(plan.value, progress.value, 0);
                const source = type === 'new' ? dv.newUndone : dv.revUndone;
                if (!source.length) return alert(type === 'new' ? '今日新词任务已全部完成 🎉' : '今日没有待复习任务 🎉');
                const data = planBookData();
                const wordMeta = {};
                Object.keys(data).forEach(u => (data[u] || []).forEach(w => { wordMeta[w.word] = w; }));
                testList.value = source.map(x => wordMeta[x.word] || { word: x.word, meaning: '(词库中未找到释义)', english: '' });
                isExamMode.value = true;
                isWrongTestMode.value = false;
                testContext.value = { source: 'plan', type: type };
                beginTest();
            }

            function beginTest() {
                idx.value = 0; correctCount.value = 0; answerMap.value = {};
                isTesting.value = true; showResult.value = false;
                makeOpts();
            }

            function makeOpts() {
                answered.value = false; sel.value = null;
                let correct = curr.value.meaning;
                let pool = []; Object.values(allData.value).forEach(u => u.forEach(w => pool.push(w.meaning)));
                let others = [...new Set(pool)].filter(m => m !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
                opts.value = [correct, ...others].sort(() => Math.random() - 0.5);
            }

            function handleAnswer(opt) {
                if (answered.value) return;
                answered.value = true; sel.value = opt;
                const w = curr.value.word;
                const ok = opt === curr.value.meaning;
                answerMap.value[w] = ok;
                if (ok) {
                    correctCount.value++;
                    if (isWrongTestMode.value) removeWrong(w);
                } else if (!wrongs.value.find(x => x.word === w)) {
                    wrongs.value.push(curr.value);
                    SAT.store.set(SAT.K.WRONGS, wrongs.value);
                }
                // v2：答题联动掌握状态
                SAT.statusStore.applyAnswer(w, ok, vocabMode.value, (bookWordMap.value[w] || {}).unit);
                // v2.1 方案3：词级答题记录（unit 以全局词条映射为准，跨词书可归属）
                const meta = wordMetaOf(w);
                SAT.answerLog.record(w, ok, meta ? meta.unit : null);
                statusTick.value++;
                setTimeout(() => {
                    if (idx.value < testList.value.length - 1) { idx.value++; makeOpts(); }
                    else finishExam();
                }, 1100);
            }

            function finishExam() {
                // v2：计划任务测试完成 -> 答对的词自动记完成
                if (testContext.value && testContext.value.source === 'plan') {
                    testList.value.forEach(item => {
                        if (answerMap.value[item.word] !== true) return;
                        if (testContext.value.type === 'new') {
                            const d = scheduledDateFor(item.word) || SAT.todayStr();
                            const days = progress.value.days = progress.value.days || {};
                            if (!days[d]) days[d] = { done: {}, reviewDone: {} };
                            days[d].done = days[d].done || {};
                            days[d].done[item.word] = true;
                        } else {
                            const d = SAT.todayStr();
                            const days = progress.value.days = progress.value.days || {};
                            if (!days[d]) days[d] = { done: {}, reviewDone: {} };
                            const rec = days[d]; rec.reviewDone = rec.reviewDone || {};
                            if (!rec.reviewDone[item.word]) {
                                rec.reviewDone[item.word] = true;
                                const rc = progress.value.reviewCount = progress.value.reviewCount || {};
                                rc[item.word] = (rc[item.word] || 0) + 1;
                                if (rc[item.word] >= SAT.EB.length && SAT.statusStore.get(item.word) !== '已掌握') {
                                    SAT.statusStore.set(item.word, '已掌握', plan.value.bookId, (bookWordMap.value[item.word] || {}).unit);
                                    statusTick.value++;
                                }
                            }
                        }
                    });
                    SAT.saveProgress(progress.value);
                }

                if (isExamMode.value) {
                    let prefix = vocabMode.value === '700' ? '卓越班' : (vocabMode.value === '1600' ? '机考核心' : '3000词');
                    let logUnit = prefix;
                    if (testContext.value && testContext.value.source === 'plan') logUnit = '背词计划-' + (testContext.value.type === 'new' ? '今日新词' : '今日复习');
                    else if (tab.value === 'custom') logUnit = prefix + '-自选检测';
                    else if (isWrongTestMode.value) logUnit = '错题闯关';
                    else logUnit = prefix + '-抽测';

                    examLogs.value.unshift({
                        unit: logUnit,
                        score: finalScore.value,
                        date: new Date().toLocaleDateString(),
                        mode: vocabMode.value
                    });
                    SAT.store.set(SAT.K.LOGS, examLogs.value);
                }
                showResult.value = true;
            }

            function exitTest() {
                isTesting.value = false; showResult.value = false;
                isWrongTestMode.value = false; testContext.value = null;
            }

            function getStyle(opt) {
                if (!answered.value) return 'bg-white border-slate-100 hover:border-current';
                if (opt === curr.value.meaning) return 'border-green-500 bg-green-50 text-green-700';
                if (opt === sel.value) return 'border-red-500 bg-red-50 text-red-700';
                return 'opacity-40 border-slate-50';
            }

            /* ================= 闪卡 / 错题 / 看板（原样保留） ================= */
            function selectFlashUnit(u) { flashUnit.value = u; flashIdx.value = 0; isFlipped.value = false; }
            function nextFlash() { if (flashIdx.value < flashList.value.length - 1) { flashIdx.value++; isFlipped.value = false; } }
            function prevFlash() { if (flashIdx.value > 0) { flashIdx.value--; isFlipped.value = false; } }
            function removeWrong(w) {
                wrongs.value = wrongs.value.filter(i => i.word !== w);
                SAT.store.set(SAT.K.WRONGS, wrongs.value);
            }
            function clearLogs() { if (confirm('清除所有记录？')) { examLogs.value = []; SAT.store.remove(SAT.K.LOGS); } }

            function exportWrongs() {
                let csv = '\uFEFF单词,中文释义,英文释义\n';
                wrongs.value.forEach(w => {
                    csv += '"' + w.word + '","' + w.meaning + '","' + (w.english || '') + '"\n';
                });
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'Lumi_SAT_错题本.csv';
                link.click();
                URL.revokeObjectURL(link.href);
            }

            function importCSV(event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const text = e.target.result;
                    const rows = text.split('\n');
                    let unitName = file.name.replace('.csv', '');
                    let newWords = [];
                    for (let i = 1; i < rows.length; i++) {
                        let line = rows[i].trim();
                        if (!line) continue;
                        let parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                        if (parts.length >= 2) {
                            newWords.push({
                                word: parts[0].replace(/(^"|"$)/g, '').trim(),
                                meaning: parts[1].replace(/(^"|"$)/g, '').trim(),
                                english: parts.length > 2 ? parts[2].replace(/(^"|"$)/g, '').trim() : '',
                                unit: unitName
                            });
                        }
                    }
                    if (newWords.length > 0) {
                        allData.value[unitName] = newWords;
                        let savedCustom = SAT.store.get(SAT.K.CUSTOM, {});
                        savedCustom[unitName] = newWords;
                        SAT.store.set(SAT.K.CUSTOM, savedCustom);
                        refreshPlanBookOptions();
                        alert('成功导入 ' + newWords.length + ' 个单词！');
                    } else {
                        alert('未能识别文件中的单词，请确保它是带有表头（单词,释义）的CSV格式。');
                    }
                    event.target.value = '';
                };
                reader.readAsText(file);
            }

            function deleteSelectedCustomUnits() {
                if (unitsToDelete.value.length === 0) return;
                if (!confirm('确定要彻底清除这 ' + unitsToDelete.value.length + ' 个自定义词库吗？')) return;
                let savedCustom = SAT.store.get(SAT.K.CUSTOM, {});
                unitsToDelete.value.forEach(u => {
                    delete allData.value[u];
                    delete savedCustom[u];
                    selectedUnits.value = selectedUnits.value.filter(su => su !== u);
                });
                SAT.store.set(SAT.K.CUSTOM, savedCustom);
                refreshPlanBookOptions();
                alert('清除成功！');
                unitsToDelete.value = [];
            }

            /* ================= v2.1 方案2：已掌握过滤 + 单元进度 ================= */
            const filterMastered = ref(true); // true = 抽测/自选排除已掌握词
            const unitProgress = (u) => {
                void statusTick.value;
                const ws = allData.value[u] || [];
                let m = 0;
                ws.forEach(w => { if (SAT.statusStore.get(w.word) === '已掌握') m++; });
                return { mastered: m, total: ws.length };
            };
            const isUnitDone = (u) => {
                const p = unitProgress(u);
                return p.total > 0 && p.mastered === p.total;
            };

            /* ================= v2.1 方案1：备份 / 恢复 ================= */
            const restoreFile = ref(null);
            function backupDownload() {
                const payload = SAT.backup.exportAll();
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'SAT词汇系统备份_' + SAT.todayStr() + '.json';
                a.click();
                URL.revokeObjectURL(a.href);
            }
            function backupRestoreClick() {
                if (restoreFile.value) restoreFile.value.click();
            }
            function backupRestoreFile(event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    let payload = null;
                    try { payload = JSON.parse(e.target.result); } catch (err) { payload = null; }
                    const dataMap = SAT.backup.parse(payload);
                    if (!dataMap) {
                        alert('文件格式不正确：不是本系统的备份文件。');
                    } else if (confirm('恢复将覆盖备份中包含的数据项（未包含的保持不变）。\n当前未保存的改动会丢失，确认恢复吗？')) {
                        const n = SAT.backup.restore(dataMap);
                        alert('恢复完成（写入 ' + n + ' 项数据），页面即将刷新。');
                        location.reload();
                    }
                    event.target.value = '';
                };
                reader.readAsText(file);
            }

            /* ================= v2.1 方案3：薄弱点分析 ================= */
            const last30 = computed(() => {
                void statusTick.value;
                return SAT.answerLog.lastNDays(30);
            });
            const last30Max = computed(() => Math.max(1, ...last30.value.map(d => d.total)));
            const weakUnits = computed(() => {
                void statusTick.value;
                return SAT.answerLog.weakUnits(10, 5);
            });
            const dangerWords = computed(() => {
                void statusTick.value;
                return SAT.answerLog.dangerWords(3, 20).map(d => ({
                    word: d.word, count: d.count, meta: wordMetaOf(d.word),
                    inWrongs: wrongs.value.some(w => w.word === d.word)
                }));
            });
            function addDangerToWrongs(word) {
                if (wrongs.value.some(w => w.word === word)) return;
                const meta = wordMetaOf(word);
                if (!meta) return;
                wrongs.value.unshift({ word: word, meaning: meta.meaning, english: meta.english || '' });
                SAT.store.set(SAT.K.WRONGS, wrongs.value);
                statusTick.value++;
            }

            /* ================= v2：掌握 tab ================= */
            const masteryFilter = ref('all');
            const masteryKeyword = ref('');
            const masteryArchiveOpen = ref(false);
            const masteryShowAll = ref(false);

            const masteryCounts = computed(() => {
                void statusTick.value;
                const c = { '未掌握': 0, '掌握中': 0, '已掌握': 0, total: 0 };
                const map = bookWordMap.value;
                Object.keys(map).forEach(w => { c[SAT.statusStore.get(w)]++; c.total++; });
                return c;
            });

            const masteryList = computed(() => {
                void statusTick.value;
                const kw = masteryKeyword.value.trim().toLowerCase();
                let items = Object.keys(bookWordMap.value).map(w => ({
                    word: w, status: SAT.statusStore.get(w), meta: bookWordMap.value[w]
                }));
                if (masteryFilter.value !== 'all') items = items.filter(i => i.status === masteryFilter.value);
                if (kw) items = items.filter(i =>
                    i.word.toLowerCase().includes(kw) || (i.meta.meaning || '').toLowerCase().includes(kw));
                return items;
            });

            const masteryVisible = computed(() => {
                return masteryShowAll.value ? masteryList.value : masteryList.value.slice(0, 80);
            });

            const archivedWords = computed(() => {
                void statusTick.value;
                return masteryList.value.filter(i => i.status === '已掌握');
            });

            /* ================= 初始化 ================= */
            onMounted(() => {
                SAT.statusStore.init();
                SAT.answerLog.init();
                refreshPlanBookOptions();
                if (localStorage.getItem('lumi_auth') === 'true') isAuthorized.value = true;
                const savedMode = localStorage.getItem('sat_vocab_mode');
                if (savedMode) {
                    vocabMode.value = savedMode;
                    rebuildAllData();
                    flashUnit.value = sortedUnits.value[0] || '';
                }
            });

            return {
                // 认证 / 词库
                isAuthorized, passInput, checkPass, vocabMode, selectVocab, switchVocab, booksMeta,
                // 原有流程
                tab, isTesting, levelGroups, startTest, idx, testList, curr, opts,
                handleAnswer, answered, getStyle, showResult, finalScore, correctCount, wrongs, removeWrong, showAdmin,
                examLogs, isExamMode, exitTest, sortedUnits, flashUnit, flashIdx, isFlipped, flashList, selectFlashUnit,
                nextFlash, prevFlash, clearLogs, exportWrongs, selectedUnits, customCount, startCustomTest, importCSV,
                unitsToDelete, deleteSelectedCustomUnits, customUnits, isWrongTestMode, startWrongTest, totalTests, averageScore,
                playAudio: SAT.audio.play.bind(SAT.audio), isCurrentInWrongs, toggleFlashcardWrong,
                // v2 掌握状态
                statusOf, statusCounts, cycleStatus, setStatus, statusTick,
                SAT_STATUS: SAT.STATUS, STATUS_ICON: SAT.STATUS_ICON,
                masteryFilter, masteryKeyword, masteryArchiveOpen, masteryShowAll,
                masteryCounts, masteryList, masteryVisible, archivedWords, bookWordMap,
                // v2.1 方案1：备份恢复
                restoreFile, backupDownload, backupRestoreClick, backupRestoreFile,
                // v2.1 方案2：已掌握过滤
                filterMastered, unitProgress, isUnitDone,
                // v2.1 方案3：薄弱点分析
                last30, last30Max, weakUnits, dangerWords, addDangerToWrongs,
                // v2 计划
                plan, progress, planEditing, planForm, planError, dayOffset,
                planBookList, openPlanForm, savePlanForm, deletePlan,
                todayView, todayDoneRatio, dayView, toggleNewTask, toggleReviewTask, isNewTaskDone, isReviewDone,
                startPlanTest, testContext,
                // 工具
                fmtCN: SAT.fmtCN, weekdayCN: SAT.weekdayCN, todayStr: SAT.todayStr,
                planBookName(id) {
                    if (!id) return '';
                    if (id.indexOf('custom:') === 0) return '自定义 · ' + id.slice(7);
                    return SAT.BOOKS[id] ? SAT.BOOKS[id].name : id;
                }
            };
        }
    }).mount('#app');
})();
