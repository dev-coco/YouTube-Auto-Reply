chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: 'https://dev-coco.github.io/post/YouTube-Automatic-Reply/' })
})

chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
  const action = message[0]
  const init = {
    'init': () => getInit().then(data => sendResponse(data)),
    'fillSheet': () => fillSheet(...message[1]).then(data => sendResponse(data)),
    'getList': () => getList(message[1]).then(data => sendResponse(data))
  }
  init[action]()
  return true
})

const api = 'https://script.google.com/macros/s/AKfycbxk9kI-C0J_hkiErI6gnW9y6NfwOgh_y1H4nmaRuwpVF_wc-4Rk8xR6AntAI8S_S1uK/exec'

// 获取配置信息
async function getInit () {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['getContent', 'getDelayTime', 'getBlackList'], async ({ getContent, getDelayTime, getBlackList }) => {
      resolve({ getContent, getDelayTime, getBlackList })
    })
  })
}

// 写入表格
async function fillSheet (userName, content, postLink) {
  const sheetUrl = await new Promise((resolve, reject) => {
    chrome.storage.local.get(['getSheetUrl'], async ({ getSheetUrl }) => resolve(getSheetUrl))
  })
  const result = await fetch(api, {
    body: JSON.stringify({ type: 'fillSheet', sheetUrl, userName, content, postLink }),
    method: 'POST'
  }).then(response => response.text())
  return result
}

// 获取列表
async function getList () {
  const sheetUrl = await new Promise((resolve, reject) => {
    chrome.storage.local.get(['getSheetUrl'], async ({ getSheetUrl }) => resolve(getSheetUrl))
  })
  const result = await fetch(api, {
    body: JSON.stringify({ type: 'getList', sheetUrl }),
    method: 'POST'
  }).then(response => response.json())
  return result
}
