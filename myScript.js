// 处理写入HTML的限制
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  window.trustedTypes.createPolicy('default', {
    createHTML: string => string,
    createScriptURL: string => string,
    createScript: string => string
  })
}

const extensionID = document.getElementById('YoutubeAutoReply').outerText
const sendBackground = data => new Promise(resolve => chrome.runtime.sendMessage(extensionID, data, res => { resolve(res) }))

/**
 * @description 指定范围生成随机数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 随机数
 */
const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

/**
 * @description 延时 上下 30% 随机浮动
 * @param {(string|number)} delayTime - 延迟时间/秒
 */
const delay = (delayTime) => new Promise((resolve) => {
  setTimeout(
    resolve,
    getRandom(Number(delayTime) * 700, Number(delayTime) * 1300)
  )
})

// 初始化
let process = false
let database
let commentCount = 0
let likeCount = 0
let bypassCount = 0

async function inject () {
  const url = location.href
  // 非社区帖或评论界面
  if (!/comments\/|community\?/.test(url)) return
  // 获取列表，用来检测重复
  database = await sendBackground(['getList'])
  try {
    console.log('加载中')
    // 写入按钮
    let tootbar
    if (url.includes('community?')) {
      tootbar = document.querySelector('ytd-comments #count yt-formatted-string')
    } else if (url.includes('comments/')) {
      tootbar = document.getElementById('tabsContent')
    }
    tootbar.innerHTML += '<tp-yt-paper-tab id="autoReply"><div class="tab-content style-scope tp-yt-paper-tab"><div class="tab-content style-scope tp-yt-paper-tab"><ytcp-ve class="style-scope ytcp-activity-section"> 自动回复 </ytcp-ve></div><paper-ripple class="style-scope tp-yt-paper-tab"><div class="style-scope paper-ripple" style="opacity: 0.00192;"></div><div class="style-scope paper-ripple"></div></paper-ripple></div></tp-yt-paper-tab>'
    // 控制开始和停止
    document.getElementById('autoReply').addEventListener('click', () => {
      if (process) {
        process = false
      } else if (!process) {
        process = true
        // 重置计数
        commentCount = 0
        likeCount = 0
        bypassCount = 0
      }
      if (url.includes('community')) {
        // 社区帖界面需要先滚动加载评论数据
        let count = 0
        let interval
        interval = setInterval(() => {
          window.scrollTo(0, Number.MAX_SAFE_INTEGER)
          const data = ytInitialData.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[1].itemSectionRenderer.contents.length
          // 已经到底部了，复位然后执行功能
          if (data === count) {
            clearInterval(interval)
            window.scrollTo(0, 0)
            communityAutoReply()
          }
          count = data
        }, 1000)
      } else {
        autoReply()
      }
    })
  } catch (error) {
    console.log(error)
    await delay(1)
    inject()
  }
}
inject()

// 生成 SAPISIDHASH 值
async function getSApiSidHash () {
  const sha1 = str => {
    return window.crypto.subtle.digest('SHA-1', new TextEncoder('utf-8').encode(str)).then(buf => {
      return Array.prototype.map.call(new Uint8Array(buf), x => (('00' + x.toString(16)).slice(-2))).join('')
    })
  }
  const timestamp = Date.now()
  // const SAPISID = document.cookie.split('SAPISID=').pop().split('; ')[0]
  const SAPISID = document.cookie.split('SAPISID=')[1].split('; ')[0]
  const digest = await sha1(`${timestamp} ${SAPISID} ${location.origin}`)
  return `${timestamp}_${digest}`
}

// 工作室界面自动回复
async function autoReply () {
  if (!process) return
  // 获取配置
  const init = await sendBackground(['init'])
  if (!init.getContent) return alert('请设置发送内容')
  // 按钮字符
  const btnStr = document.querySelector('#autoReply ytcp-ve')
  const blackList = init.getBlackList || 'fuck|pussy|\\b(shit|ass|cunt)\\b|asshole|bitch|dick|vagina|penis|whore|stupid|devil|goddamnit|promo'
  // 黑名单关键词
  const blackListRegex = new RegExp(blackList.replace(/,/g, '|'), 'gi')
  const obj = {
    context: {
      client: {
        clientName: ytcfg.data_.INNERTUBE_CONTEXT_CLIENT_NAME,
        clientVersion: ytcfg.data_.INNERTUBE_CLIENT_VERSION
      },
      user: {
        delegationContext: {
          externalChannelId: ytcfg.data_.CHANNEL_ID,
          roleType: {
            channelRoleType: 'CREATOR_CHANNEL_ROLE_TYPE_OWNER'
          }
        }
      }
    },
    sortOrder: 'NEWEST',
    maxReplies: 10,
    channelId: ytcfg.data_.CHANNEL_ID,
    moderationState: 'PUBLISHED',
    commentsFilter: {
      commentCategoryIn: {
        values: ['COMMENT_CATEGORY_NOT_ENGAGED']
      }
    },
    commentsFilterForHeldForReviewTab: {}
  }
  if (ytcfg.data_.DELEGATED_SESSION_ID) obj.context.user['onBehalfOfUser'] =  ytcfg.data_.DELEGATED_SESSION_ID
  const headers = {
    accept: '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    authorization: 'SAPISIDHASH ' + await getSApiSidHash(),
    'content-type': 'application/json'
  }
  if (ytcfg.data_.SIGNIN_URL.includes('authuser=1')) headers['x-goog-authuser'] = 1
  const json = await fetch(`https://studio.youtube.com/youtubei/v1/comment/get_comments?alt=json&key=${ytcfg.data_.INNERTUBE_API_KEY}`, {
    headers,
    body: JSON.stringify(obj),
    method: 'POST'
  }).then(response => response.json())
  const data = json.contents.itemSectionRenderer.contents
  for (let i = 0; i < data.length - 1; i++) {
    const info = data[i].commentThreadRenderer.comment.commentRenderer
    const userID = info.authorText.simpleText
    const content = info.contentText.runs.map(x => x.text).join('')
    const replyID = info.actionButtons.commentActionButtonsRenderer.replyButton.buttonRenderer.navigationEndpoint.createCommentReplyDialogEndpoint.dialog.commentReplyDialogRenderer.replyButton.buttonRenderer.serviceEndpoint.createCommentReplyEndpoint.createReplyParams
    const heartID = info.actionButtons.commentActionButtonsRenderer.creatorHeart.creatorHeartRenderer.heartEndpoint.performCommentActionEndpoint.action
    const postLink = info.videoThumbnail.commentVideoThumbnailRenderer.viewCommentButton.buttonRenderer.navigationEndpoint.commandMetadata.webCommandMetadata.url
    if (blackListRegex.test(content)) {
      // 黑名单，跳过
      bypassCount++
      continue
    } else if (database[userID]) {
      // 重复只点赞
      await heartComment(heartID)
      likeCount++
    } else {
      await replyComment(replyID, userID, postLink)
      // 写入表格
      await sendBackground(['fillSheet', [userID, content, postLink]])
      commentCount++
      // 记录到数据库
      database[userID] = true
    }
    btnStr.innerText = `自动回复 💬 ${commentCount} / ❤️ ${likeCount} / 👤 ${bypassCount}`
    if (!process) return
    await delay(init.getDelayTime || 60)
  }
  autoReply()
}
// CAUQBxoaVWd6X2w3Q0VzVTdpZEhSNDg4UjRBYUFCQWcwADgAShUxMDg4NjM1NDk0OTI0Mzk0MTExMzOoAQGyASRVZ2t4aXMzQUFwaVJQb2s2NE53TVN5cUFJVElvMWtYTkd6eDi6ARhVQ2dVdGtBU2ZvcjFaWXRobjZnX0QtQkHwAQA%3D
// 社区帖自动回复
let isAdmin = true
async function communityAutoReply () {
  if (!process) return
  // 获取配置
  const init = await sendBackground(['init'])
  if (!init.getContent) return alert('请设置发送内容')
  // 按钮字符
  const btnStr = document.querySelector('#autoReply ytcp-ve')
  const blackList = init.getBlackList || 'fuck|pussy|\\b(shit|ass|cunt)\\b|asshole|bitch|dick|vagina|penis|whore|stupid|devil|goddamnit|promo'
  // 黑名单关键词
  const blackListRegex = new RegExp(blackList.replace(/,/g, '|'), 'gi')
  const data = ytInitialData.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[1].itemSectionRenderer.contents
  for (let i = 0; i < data.length - 1; i++) {
    console.log(1)
    const info = data[i].commentThreadRenderer.comment.commentRenderer
    const userID = info.authorText.simpleText
    const content = info.contentText.runs.map(x => x.text).join('')
    const replyID = info.actionButtons.commentActionButtonsRenderer.replyButton.buttonRenderer.navigationEndpoint.createCommentReplyDialogEndpoint.dialog.commentReplyDialogRenderer.replyButton.buttonRenderer.serviceEndpoint.createCommentReplyEndpoint.createReplyParams
    let heartID, heartStatus
    try {
      // 仅限管理员
      heartID = info.actionButtons.commentActionButtonsRenderer.creatorHeart.creatorHeartRenderer.heartEndpoint.performCommentActionEndpoint.action
      heartStatus = info.actionButtons.commentActionButtonsRenderer.creatorHeart.creatorHeartRenderer.isHearted
    } catch {
      isAdmin = false
    }
    const likeID = info.actionButtons.commentActionButtonsRenderer.likeButton.toggleButtonRenderer.defaultServiceEndpoint.performCommentActionEndpoint.action
    const postLink = location.href
    const likeStatus = info.actionButtons.commentActionButtonsRenderer.likeButton.toggleButtonRenderer.isToggled
    const replyStatus = info.replyCount
    // 黑名单和重复跳过
    if (blackListRegex.test(content) || heartStatus || replyStatus || likeStatus) {
      bypassCount++
      continue
    }
    if (database[userID]) {
      // 重复只点赞
      isAdmin ? await heartComment(heartID) : await likeComment(likeID)
      likeCount++
    } else {
      await replyComment(replyID, userID, postLink)
      // 写入表格
      await sendBackground(['fillSheet', [userID, content, postLink]])
      commentCount++
      // 记录到数据库
      database[userID] = true
    }
    btnStr.innerText = `自动回复 💬 ${commentCount} / ❤️ ${likeCount} / 👤 ${bypassCount}`
    if (!process) return
    await delay(init.getDelayTime || 60)
  }
  alert('完成')
}

/**
 * @description 回复评论
 * @param {string} createReplyParams - 回复参数
 * @param {string} userID - 用户ID
 * @param {string} postLink - 帖子链接
 * @returns {string} 回复状态
 */
async function replyComment (createReplyParams, userID, postLink) {
  const init = await sendBackground(['init'])
  const contentList = init.getContent.split('\n')
  const contentWithUrl = contentList.filter(x => x.includes('https'))
  const contentWithoutUrl = contentList.filter(x => !x.includes('https'))
  let content
  if (postLink.includes('watch') && contentWithoutUrl.length) {
    // 视频
    content = contentWithoutUrl
  } else if (postLink.includes('community') && contentWithUrl.length) {
    // 社区帖
    content = contentWithUrl
  } else {
    content = contentList
  }
  // 格式化评论的内容
  const commentText = content[getRandom(0, content.length - 1)].replace(/@@@/g, userID).replace(/\\n/g, '\n')
  const obj = {
    commentText,
    createReplyParams,
    context: {
      client: {
        clientName: ytcfg.data_.INNERTUBE_CONTEXT_CLIENT_NAME,
        clientVersion: ytcfg.data_.INNERTUBE_CLIENT_VERSION
      },
      user: {
        delegationContext: {
          externalChannelId: ytcfg.data_.CHANNEL_ID,
          roleType: {
            channelRoleType: 'CREATOR_CHANNEL_ROLE_TYPE_OWNER'
          }
        }
      }
    }
  }
  if (ytcfg.data_.DELEGATED_SESSION_ID) obj.context.user['onBehalfOfUser'] =  ytcfg.data_.DELEGATED_SESSION_ID
  const headers = {
    accept: '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    authorization: 'SAPISIDHASH ' + await getSApiSidHash(),
    'content-type': 'application/json'
  }
  if (ytcfg.data_.SIGNIN_URL.includes('authuser=1')) headers['x-goog-authuser'] = 1
  const json = await fetch(`/youtubei/v1/comment/create_comment_reply?alt=json&key=${ytcfg.data_.INNERTUBE_API_KEY}`, {
    headers,
    body: JSON.stringify(obj),
    method: 'POST'
  }).then(response => response.json())
  // console.log('replyComment', json)
  return 'success'
}

/**
 * @description 点红心
 * @param {string} heartID - 红心ID
 * @returns {string} 红心状态
 */
async function heartComment (heartID) {
  const obj = {
    context: {
      client: {
        clientName: ytcfg.data_.INNERTUBE_CONTEXT_CLIENT_NAME,
        clientVersion: ytcfg.data_.INNERTUBE_CLIENT_VERSION
      },
      user: {
        delegationContext: {
          externalChannelId: ytcfg.data_.CHANNEL_ID,
          roleType: {
            channelRoleType: 'CREATOR_CHANNEL_ROLE_TYPE_OWNER'
          }
        }
      }
    },
    actions: [heartID]
  }
  if (ytcfg.data_.DELEGATED_SESSION_ID) obj.context.user['onBehalfOfUser'] =  ytcfg.data_.DELEGATED_SESSION_ID
  const headers = {
    accept: '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    authorization: 'SAPISIDHASH ' + await getSApiSidHash(),
    'content-type': 'application/json'
  }
  if (ytcfg.data_.SIGNIN_URL.includes('authuser=1')) headers['x-goog-authuser'] = 1
  const json = await fetch(`/youtubei/v1/comment/perform_comment_action?alt=json&key=${ytcfg.data_.INNERTUBE_API_KEY}`, {
    headers,
    body: JSON.stringify(obj),
    method: 'POST'
  }).then(response => response.json())
  // console.log('heartComment', json)
  return 'success'
}

/**
 * @description 点赞
 * @param {string} heartID - 点赞ID
 * @returns {string} 点赞状态
 */
async function likeComment (likeID) {
  const obj = {
    context: {
      client: {
        clientName: ytcfg.data_.INNERTUBE_CONTEXT_CLIENT_NAME,
        clientVersion: ytcfg.data_.INNERTUBE_CLIENT_VERSION
      },
      user: {
        delegationContext: {
          externalChannelId: ytcfg.data_.CHANNEL_ID,
          roleType: {
            channelRoleType: 'CREATOR_CHANNEL_ROLE_TYPE_OWNER'
          }
        }
      }
    },
    actions: [likeID]
  }
  if (ytcfg.data_.DELEGATED_SESSION_ID) obj.context.user['onBehalfOfUser'] =  ytcfg.data_.DELEGATED_SESSION_ID
  const headers = {
    accept: '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    authorization: 'SAPISIDHASH ' + await getSApiSidHash(),
    'content-type': 'application/json',
  }
  if (ytcfg.data_.SIGNIN_URL.includes('authuser=1')) headers['x-goog-authuser'] = 1
  const json = await fetch(`/youtubei/v1/comment/perform_comment_action?prettyPrint=false&key=${ytcfg.data_.INNERTUBE_API_KEY}`, {
    headers,
    body: JSON.stringify(obj),
    method: 'POST'
  }).then(response => response.json())
  // console.log('likeComment', json)
  return 'success'
}
