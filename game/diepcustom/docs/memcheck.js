// 在页面上下文执行：搜索 Upgrades 与 升级 的运行时副本
(() => {
    const heap = new Uint8Array(Module.HEAPU8.buffer);
    const find = (s) => {
        const out = [];
        for (let i = 0; i < heap.length - s.length; i++) {
            let ok = true;
            for (let j = 0; j < s.length; j++) {
                if (heap[i + j] !== s.charCodeAt(j)) { ok = false; break; }
            }
            if (ok) out.push(i);
            if (out.length >= 8) break;
        }
        return out.join(',');
    };
    console.log('UPG=' + find('Upgrades') + ' | ZH=' + find('升级'));
})();
