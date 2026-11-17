// 发音模块（原逻辑保留，重构为独立模块）
window.SAT = window.SAT || {};

SAT.audio = {
    play(text) {
        const audioUrl = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=2';
        const audio = new Audio(audioUrl);
        audio.play().catch(err => {
            console.warn('网络音频播放失败，尝试使用系统自带语音兜底', err);
            this.fallback(text);
        });
    },
    fallback(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-US';
            u.rate = 0.85;
            window.speechSynthesis.speak(u);
        }
    }
};
