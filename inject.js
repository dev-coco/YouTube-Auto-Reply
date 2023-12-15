if (location.href.includes('comments/inbox')) {
  const element = document.createElement('div')
  element.innerHTML = chrome.runtime.id
  element.id = 'YoutubeAutoReply'
  element.style.display = 'none'
  document.documentElement.appendChild(element)
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('myScript.js')
  ;(document.head || document.documentElement).appendChild(script)
}