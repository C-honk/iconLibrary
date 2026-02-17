/*
 * IP信息查询脚本 - 增强参数兼容版
 */

// --- 1. 深度解析参数 (关键修改) ---
let shouldMask = false;
if (typeof $argument !== "undefined" && $argument !== null) {
    // 打印日志到 Loon -> 脚本 -> 日志，方便你排查到底传了什么
    console.log(`[IP查询] 原始参数内容: "${$argument}"`);
    
    // 移除非法字符（如空格、中括号），统一转小写判断
    const cleanArg = $argument.toLowerCase().replace(/[\[\]\s]/g, "");
    if (cleanArg === "true" || cleanArg.includes("mask=true")) {
        shouldMask = true;
    }
}
console.log(`[IP查询] 最终隐藏开关状态: ${shouldMask}`);

const scriptName = "IP信息查询";

// --- 2. IP 遮蔽逻辑 ---
const maskIp = (ip) => {
    if (!shouldMask || !ip) return ip;
    if (ip.includes('.')) {
        return ip.replace(/\.(\d+)$/, ".***");
    }
    if (ip.includes(':')) {
        return ip.replace(/:([0-9a-fA-F]+)$/, ":****");
    }
    return ip;
};

// --- 国家映射 ---
const countryMap = {
    "HK": "香港", "TW": "台湾", "KR": "韩国", "JP": "日本",
    "DE": "德国", "FR": "法国", "GB": "英国", "US": "美国",
    "SG": "新加坡", "AU": "澳大利亚", "CA": "加拿大", "RU": "俄罗斯",
    "IN": "印度", "IT": "意大利", "ES": "西班牙", "BR": "巴西",
    "NL": "荷兰", "CH": "瑞士", "SE": "瑞典", "NO": "挪威",
    "DK": "丹麦", "FI": "芬兰", "PL": "波兰", "UA": "乌克兰",
    "MX": "墨西哥", "AE": "阿联酋", "SA": "沙特阿拉伯", "TR": "土耳其",
    "AR": "阿根廷", "ZA": "南非", "NZ": "新西兰", "MY": "马来西亚",
    "TH": "泰国", "PH": "菲律宾", "VN": "越南", "ID": "印度尼西亚"
};

(async () => {
    const inputParams = $environment.params;
    const nodeName = inputParams.node;
    let nodeAddress = inputParams.nodeInfo.address;

    let entryHtml = "";
    let landingHtml = "";
    let errorLogs = [];

    // 落地 IP 请求
    try {
        const landingInfo = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Timeout")), 5000);
            $httpClient.get({ url: "http://ipinfo.io/json", node: nodeName }, (err, resp, body) => {
                clearTimeout(timer);
                if (err) return reject(new Error("Failed"));
                try { resolve(JSON.parse(body)); } catch { resolve({}); }
            });
        });

        if (landingInfo?.ip) {
            let countryName = countryMap[landingInfo.country] || landingInfo.country || "未知";
            landingHtml = `IP：${maskIp(landingInfo.ip)}<br>所在地：${countryName}<br>${landingInfo.org ? `运营商：${landingInfo.org.replace(/^AS\d+\s*/, "")}<br>` : ""}`;
        }
    } catch (err) { errorLogs.push(`落地: ${err.message}`); }

    // 入口 IP 请求
    try {
        let entryIp = nodeAddress;
        const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(nodeAddress) || /:/.test(nodeAddress);
        if (!isIp) {
            const dnsRes = await new Promise((resolve) => {
                $httpClient.get({ url: `http://223.5.5.5/resolve?name=${nodeAddress}&type=A&short=1` }, (err, resp, body) => {
                    if (err) resolve(null);
                    try { resolve(JSON.parse(body)); } catch { resolve(null); }
                });
            });
            if (dnsRes && dnsRes.length > 0) entryIp = dnsRes[0];
        }

        const entryInfo = await new Promise((resolve, reject) => {
            $httpClient.get({ url: `http://api-v3.speedtest.cn/ip?ip=${entryIp}`, node: "DIRECT" }, (err, resp, body) => {
                if (err) return reject(new Error("Failed"));
                try { resolve(JSON.parse(body)); } catch { resolve({}); }
            });
        });

        if (entryInfo?.data) {
            const d = entryInfo.data;
            entryHtml = `IP：${maskIp(entryIp)}<br>所在地：${(d.province || "") + (d.city || "")}<br>运营商：${d.isp || ""}<br>`;
        }
    } catch (err) { errorLogs.push(`入口: ${err.message}`); }

    const html = `
        <p style="text-align:center; font-family:-apple-system; font-size:14px; line-height:1.4;">
            <br>
            ${entryHtml ? `<span style="color:orange;">入口位置</span><br>${entryHtml}<br>` : ""}
            ${landingHtml ? `<span style="color:#007AFF;">落地位置</span><br>${landingHtml}<br>` : ""}
            <span style="color:gray; font-size:12px;">节点: ${nodeName}</span>
            ${errorLogs.length ? `<br><span style="color:red; font-size:10px;">${errorLogs.join(" ")}</span>` : ""}
        </p>`;

    $done({ title: scriptName, htmlMessage: html });
})();
