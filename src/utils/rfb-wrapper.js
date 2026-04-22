// 直接从 npm 包导入 RFB（顶层 await 已通过 patch-package 修复）
let RFBClass = null;
export async function loadRFB() {
    if (RFBClass)
        return RFBClass;
    const mod = await import('@novnc/novnc/lib/rfb.js');
    RFBClass = mod.default;
    return RFBClass;
}
