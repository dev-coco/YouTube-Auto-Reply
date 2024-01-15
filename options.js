const content = document.getElementById('content')
const sheetUrl = document.getElementById('sheetUrl')
const blackList = document.getElementById('blackList')
const delayTime = document.getElementById('delayTime')

content.addEventListener('keyup', () => chrome.storage.local.set({ getContent: content.value }))
blackList.addEventListener('keyup', () => chrome.storage.local.set({ getBlackList: blackList.value }))
delayTime.addEventListener('keyup', () => chrome.storage.local.set({ getDelayTime: delayTime.value }))
sheetUrl.addEventListener('keyup', () => chrome.storage.local.set({ getSheetUrl: sheetUrl.value }))

// 恢复设置的内容
chrome.storage.local.get(['getContent', 'getDelayTime', 'getBlackList', 'getSheetUrl'], ({ getContent, getDelayTime, getBlackList, getSheetUrl }) => {
  content.value = getContent || ''
  sheetUrl.value = getSheetUrl || ''
  blackList.value = getBlackList || 'fuck|pussy|\\b(shit|ass|cunt)\\b|asshole|bitch|dick|vagina|penis|whore|stupid|devil|goddamnit|promo'
  delayTime.value = getDelayTime || 60
})
