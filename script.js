/* global tmi, Howl */

const chatContainer = document.getElementById("chat"),
  kbdSnd = document.getElementById("kbdSnd"),
  spcSnd = document.getElementById("spcSnd"),
  entSnd = document.getElementById("entSnd")

let data = { clist: ["alveussanctuary"], spd: 25, vol: 50, fot: 10, fit: 60, css: '@import url("./default.css");', shameless_plug_delay: 1 },
  autoFillTO,
  emotes = {},
  users = {},
  queue = [],
  lastEl,
  lastHTML,
  lastHeight,
  lastChars = [],
  scrollEnabled = true,
  snd,
  skipUpdate,
  sndv = 1,
  interval = 256,
  maxvol = 1,
  fadeInRate = 0.1,
  fadeOutRate = 0.1

function init() {
  loadData()
  document.getElementsByName("c")[0].addEventListener("focus", clearOnFocus)
  document.getElementById("cssPreset").addEventListener("change", (e) => {
    let lines = document.getElementsByName("css")[0].value.split("\n")
    if (!lines[0].includes("@import")) lines.unshift("")
    lines[0] = e.target.value.replaceAll(";", ";\n").replaceAll("{", "{\n").replaceAll("}", "}\n")
    document.getElementsByName("css")[0].value = lines.join("\n").trim() + "\n"
  })
  document.getElementById("resetBtn").addEventListener("click", resetData)
  if (document.getElementById("usrInp")) {
    document.getElementById("usrInp").addEventListener("change", (e) => {
      data.username = e.target.value || null
      saveData()
    })
    document.getElementById("pwInp").addEventListener("change", (e) => {
      data.password = e.target.value || null
      saveData()
    })
  }

  for (let v of data.clist) {
    let el = document.createElement("option")
    el.value = v
    document.getElementById("clist").appendChild(el)
  }

  autoFillTO = setInterval(autoFill, 40)

  if (!location.search) return
  document.body.style.overflow = "hidden"

  let params = new URLSearchParams(location.search)
  let chan = params.get("c").toLocaleLowerCase()
  data.spd = parseFloat(params.get("spd")) || data.spd
  data.vol = parseFloat(params.get("vol") || data.vol)
  data.fot = parseFloat(params.get("fot")) || data.fot
  data.fit = parseFloat(params.get("fit")) || data.fit
  data.css = params.get("css") || data.css

  if (chan.includes("?")) chan = chan.slice(0, chan.indexOf("?"))
  if (chan.includes("/")) chan = chan.slice(chan.lastIndexOf("/") + 1)
  // if (location.search !== "?c=" + chan) return (location.search = "?c=" + chan)

  interval = 1000 / data.spd
  maxvol = sndv = data.vol / 100
  fadeOutRate = maxvol / data.fot / data.spd
  fadeInRate = maxvol / data.fit / data.spd
  document.getElementById("userStyle").textContent = data.css

  kbdSnd.loop = true
  snd = new Howl({ src: "./assets/space.wav", autoplay: true })
  document.addEventListener("click", (e) => {
    sndv = maxvol
    snd.play()
    kbdSnd.play()
    spcSnd.play()
    entSnd.play()
    entSnd.volume = maxvol
    skipUpdate = 8
    scrollEnabled = false
    document.body.style.overflow = null
    setTimeout((e) => {
      scrollEnabled = true
      document.body.style.overflow = "hidden"
    }, 1024 * 64)
  })

  const client = new tmi.Client({
    options: { debug: true },
    channels: [chan],
    identity: { username: data.username, password: data.password },
  })
  client.connect().catch(console.error)
  data.clist = data.clist.filter((id) => id != chan)
  client.on("join", (channel, username, self) => {
    if (data.clist.includes(chan)) return
    data.clist = data.clist.filter((id) => id != chan)
    data.clist.unshift(chan)
    queue.push({
      user: { username: "[info]" },
      tags: { username: "[info]" },
      message: `Connected to @${chan}`,
    })
    saveData()
  })
  client.on("messagedeleted", (channel, username, deletedMessage, userstate) => {
    console.log(channel, username, deletedMessage, userstate)
    let id = userstate["target-msg-id"]
    let el = document.getElementById("message-" + id)
    if (el) {
      el.innerHTML = "<center><em>&lt;message deleted&gt;</em></center>"
      setTimeout((e) => {
        el.parentElement.removeChild(el)
      }, 4096)
    }
    let i = queue.length
    while (i) {
      i--
      if (queue[i].tags.id == id) queue.splice(i, 1)
    }
  })
  client.on("message", (channel, tags, message, self) => {
    console.log(tags)
    users[tags.username] = users[tags.username] || tags
    users[tags.username].count = users[tags.username].count || 0
    users[tags.username].count++

    queue = queue.filter((msg) => msg.tags.username + ":" + msg.message != tags.username + ":" + message)
    queue.push({
      user: users[tags.username],
      tags: tags,
      message: message,
    })
    queue.sort((a, b) => b.message.length - a.message.length)
    while (queue.length > 8) queue.pop()
  })

  saveData()
  document.body.classList.remove("start")
  setInterval(update, interval)

  setTimeout(() => {
    loadData()
    data.shameless_plug_delay = data.shameless_plug_delay || 1
    data.shameless_plug_delay *= 2
    saveData()
    queue.push({
      user: { username: "[info]" },
      tags: { username: "[info]" },
      message: `This chat widget is powered by Twitch Typist, made by @poeticAndroid! Get it for your own stream at ${location.toString().slice(0, location.toString().indexOf("/", 8)) + location.pathname}`,
    })
  }, 1024 * 64 * data.shameless_plug_delay)
}

function autoFill() {
  if (document.getElementsByName("c")[0].value == data.clist[0]) clearInterval(autoFillTO)
  document.getElementsByName("c")[0].value = data.clist[0]
  if (document.getElementById("usrInp")) document.getElementById("usrInp").value = data.username || ""
  document.getElementsByName("spd")[0].value = data.spd
  document.getElementsByName("vol")[0].value = data.vol
  document.getElementsByName("fit")[0].value = data.fit
  document.getElementsByName("fot")[0].value = data.fot
  document.getElementsByName("css")[0].value = data.css
  kbdSnd.volume = spcSnd.volume = entSnd.volume = 0
}

function update() {
  if (skipUpdate > 0) {
    skipUpdate--
  } else if (!lastEl) {
    kbdSnd.volume = 0
    entSnd.play()
    skipUpdate = 4
    lastEl = document.createElement("p")
    lastEl.classList.add("new")
    lastEl.style.maxHeight = "0"
    chatContainer.appendChild(lastEl)
    lastHTML = ""
    lastHeight = -1
    while (document.getElementById("chat").childElementCount > 32)
      document.getElementById("chat").removeChild(document.getElementById("chat").firstElementChild)
  } else if (lastChars.length) {
    lastHTML += lastChars.shift()
    lastEl.innerHTML = lastHTML
    lastEl.classList.remove("new")
    if (snd) {
      if (sndv > 0) sndv -= fadeOutRate
      kbdSnd.volume = spcSnd.volume = entSnd.volume = Math.min(Math.max(0, sndv), maxvol)
      snd.volume(sndv)
      if (!lastHTML.slice(-1).trim()) {
        kbdSnd.volume = 0
        snd.play()
        skipUpdate = 1
      }
    }
    if (lastHeight != lastEl.clientHeight) {
      lastHeight = lastEl.clientHeight
      lastEl.style.maxHeight = lastEl.clientHeight + 32 + "px"
    } else {
      lastEl.style.maxHeight = lastEl.clientHeight + 1 + "px"
    }
    if (scrollEnabled) scrollBy(0, lastEl.clientHeight)
  } else if (lastHTML) {
    setTimeout(
      (el) => {
        el.style.maxHeight = null
        scrollBy(0, el.offsetHeight)
      },
      1024,
      lastEl
    )
    lastEl.classList.add("old")
    lastEl = null
  } else if (queue.length) {
    let tags = queue[0].tags
    lastEl.id = "message-" + queue[0].tags.id
    let color = colorToHex(colorHash(tags.username))
    lastChars = htmlChars(
      `<span class="big avatar" style="color:#${color};">${emojiHash(tags.username)}</span>` +
      // `<img class="avatar" src="https://api.dicebear.com/9.x/lorelei-neutral/svg?seed=${tags.username}&flip=false&backgroundColor=transparent&eyebrowsColor=${color}&eyesColor=${color}&frecklesColor=${color}&mouthColor=${color}&noseColor=${color}&glassesColor=777777" />` +
      `<strong style="color:#${color};">${tags["display-name"] || tags.username}${tags["message-type"] == "action" ? "</strong> <em>" : ":</strong> "}` +
      parseEmotes(queue[0].message, queue[0].tags.emotes)
    )
    queue.shift()
  } else if (sndv < maxvol) {
    sndv += fadeInRate
    kbdSnd.volume = spcSnd.volume = entSnd.volume = 0
  }
}

function parseEmotes(msg, ems) {
  let _s = msg + "  "
  msg = []
  for (let c of _s) msg.push(c)
  let startTag = -1
  let endTag = ""
  let tagChar = /\S/
  for (let i = 0; i < msg.length; i++) {
    msg[i] = escapeHtml(msg[i])
    if (endTag) {
      if (msg[i]?.match(tagChar)) {
        msg[startTag] += msg[i]
      } else {
        msg[startTag] += '">'
        msg[i - 1] += endTag
        endTag = ""
        tagChar = /\S/
      }
    }
    if (msg[i] == "@" && !msg[i - 1]?.trim()) {
      startTag = i
      let name = ""
      tagChar = /[a-zA-Z_0-9]/
      for (let j = i + 1; msg[j]?.match(tagChar); j++) name += msg[j]
      msg[startTag] = `<span class="mention" style="color:${colorHash(name)};"><span class="avatar">${emojiHash(name)}</span><span title="`
      endTag = "</span></span>"
    }
    if (msg[i] == ":" && msg[i + 1] == "/" && msg[i + 2] == "/") {
      startTag = i
      while (msg[startTag]?.trim()) startTag--
      msg[++startTag] = '<a target="_blank" href="https:'
      msg[startTag + 1] = "ht"
      endTag = "</a>"
    }
  }
  try {
    for (let key in ems) {
      for (let range of ems[key]) {
        range = JSON.parse("[" + range.replace("-", ",") + "]")
        for (let i = range[0]; i < range[1]; i++) {
          msg[i] = ""
        }
        msg[range[1]] = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${escapeHtml(key)}/default/dark/1.0" />`
      }
    }
  } catch (err) {
    console.error(err)
    return msg.join("").trim()
  }
  return msg.join("").trim()
}

function htmlChars(html) {
  let chars = []
  let p = 0
  while (p < html.length) {
    if (html[p] == "<" && html.indexOf(">", p) > 0) {
      chars.push(html.slice(p, html.indexOf(">", p) + 1))
      p = html.indexOf(">", p) + 1
    } else if (html[p] == "&" && html.indexOf(";", p) > 0) {
      chars.push(html.slice(p, html.indexOf(";", p) + 1))
      p = html.indexOf(";", p) + 1
    } else {
      chars.push(escapeHtml(html[p]))
      p++
    }
  }
  return chars
}

function clearOnFocus(e) {
  e.target.value = ""
  e.target.removeAttribute("title")
  sessionStorage.setItem("push2play/menuShown", true)
  // e.target.removeEventListener("focus", clearOnFocus)
}

function resetData() {
  if (confirm("Are you sure you want to\nreset all data to default values?")) {
    localStorage.removeItem(absUrl("save.json"))
    location.reload(true)
  }
}

function colorHash(seed) {
  seed = seed.toLocaleLowerCase().trim()
  let n = seed.length
  for (let c of seed) n += c.codePointAt() * c.codePointAt()
  return `hsl(${n % 360}deg, 50%, 50%)`
}

function emojiHash(seed) {
  seed = seed.toLocaleLowerCase().trim()
  let n = seed.length
  for (let c of seed) n += c.codePointAt() * c.codePointAt()
  return emojis[n % emojis.length]
}

const _g = document.createElement("canvas").getContext("2d")
function colorToHex(color) {
  let hex = ""
  _g.fillStyle = color
  _g.fillRect(0, 0, 1, 1)
  let rgb = _g.getImageData(0, 0, 1, 1).data
  hex = "00" + rgb[2].toString(16) + hex.slice(-0)
  hex = "00" + rgb[1].toString(16) + hex.slice(-2)
  hex = "00" + rgb[0].toString(16) + hex.slice(-4)
  return hex.slice(-6)
}

const _absUrl_a = document.createElement("a")
function absUrl(url) {
  _absUrl_a.href = url
  return _absUrl_a.href
}
function escapeHtml(str) {
  _absUrl_a.textContent = str
  return _absUrl_a.innerHTML
}

function loadData() {
  data = JSON.parse(localStorage.getItem(absUrl("save.json"))) || data
}
function saveData() {
  localStorage.setItem(absUrl("save.json"), JSON.stringify(data, null, 2))
}
init()

const emojis = [
  '🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🦺', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴', '🫎',
  '🫏', '🐎', '🦄', '🦓', '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙',
  '🦒', '🐘', '🦣', '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🦫', '🦔', '🦇', '🐻', '❄', '🐨', '🐼', '🦥', '🦦',
  '🦨', '🦘', '🦡', '🐾', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧', '🕊', '🦅', '🦆', '🦢', '🦉', '🦤', '🪶', '🦩',
  '🦚', '🦜', '🪽', '🪿', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🦭', '🐟', '🐠', '🐡',
  '🦈', '🐙', '🐚', '🪸', '🪼', '🐌', '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🪳', '🕷', '🕸', '🦂', '🦟', '🪰', '🪱',
  '🦠', '💐', '🌸', '💮', '🪷', '🏵', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🪻', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌾',
  '🌿', '☘', '🍀', '🍁', '🍂', '🍃', '🪹', '🪺', '🍄', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐',
  '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅',
  '🥜', '🫘', '🌰', '🫚', '🫛', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟',
  '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱',
  '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑',
  '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵',
  '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🫗', '🥤', '🧋', '🧃', '🧉', '🧊', '🥢', '🍽', '🍴', '🥄', '🔪',
  '🫙', '🏺', '🎃', '🎄', '🎆', '🎇', '🧨', '✨', '🎈', '🎉', '🎊', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧', '🎀', '🎁',
  '🎗', '🎟', '🎫', '🎖', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '⚾', '🥎', '🏀', '🏐', '🏈', '🏉', '🎾', '🥏', '🎳', '🏏',
  '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '⛸', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎯', '🪀', '🪁', '🔫',
  '🎱', '🔮', '🪄', '🎮', '🕹', '🎰', '🎲', '🧩', '🧸', '🪅', '🪩', '🪆', '♠', '♥', '♦', '♣', '♟', '🃏', '🀄', '🎴',
  '🎭', '🖼', '🎨', '🧵', '🪡', '🧶', '🪢', '🌍', '🌎', '🌏', '🌐', '🗺', '🗾', '🧭', '🏔', '⛰', '🌋', '🗻', '🏕', '🏖',
  '🏜', '🏝', '🏞', '🏟', '🏛', '🏗', '🧱', '🪨', '🪵', '🛖', '🏘', '🏚', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨',
  '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '🗼', '🗽', '⛲', '⛺', '🌁', '🌃', '🏙', '🌄', '🌅', '🌆', '🌇', '🌉', '♨',
  '🎠', '🛝', '🎡', '🎢', '💈', '🎪', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍',
  '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🛻', '🚚', '🚛', '🚜', '🏎', '🏍', '🛵', '🦽', '🦼',
  '🛺', '🚲', '🛴', '🛹', '🛼', '🚏', '🛣', '🛤', '🛢', '⛽', '🛞', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '🛟', '⛵', '🛶',
  '🚤', '🛳', '⛴', '🛥', '🚢', '✈', '🛩', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰', '🚀', '🛸', '🛎', '🧳',
  '⏳', '⏰', '⏱', '⏲', '🕰', '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', '🕡', '🕖',
  '🕢', '🕗', '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', '🕦', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛',
  '🌜', '🌡', '☀', '🌝', '🌞', '🪐', '⭐', '🌟', '🌠', '🌌', '☁', '⛅', '⛈', '🌤', '🌥', '🌦', '🌧', '🌨', '🌩', '🌪',
  '🌫', '🌬', '🌀', '🌈', '🌂', '☂', '☔', '⛱', '⚡', '☃', '⛄', '☄', '🔥', '💧', '🌊', '👓', '🕶', '🥽', '💎', '🔇',
  '🔈', '🔉', '🔊', '📢', '📣', '📯', '🔔', '🔕', '🎼', '🎵', '🎶', '🎙', '🎚', '🎛', '🎤', '🎧', '📻', '🎷', '🪗', '🎸',
  '🎹', '🎺', '🎻', '🪕', '🥁', '🪘', '🪇', '🪈', '📱', '📲', '☎', '📞', '📟', '📠', '🔋', '🪫', '🔌', '💻', '🖥', '🖨',
  '🖱', '🖲', '💽', '💾', '💿', '📀', '🧮', '🎥', '🎞', '📽', '🎬', '📺', '📷', '📸', '📹', '📼', '🔍', '🔎', '🕯', '💡',
  '🔦', '🏮', '🪔', '📔', '📕', '📖', '📗', '📘', '📙', '📚', '📓', '📒', '📃', '📜', '📄', '📰', '🗞', '📑', '🔖', '🏷',
  '💰', '🪙', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹', '✉', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬',
  '📭', '📮', '🗳', '✏', '✒', '🖋', '🖊', '🖌', '🖍', '📝', '💼', '📁', '📂', '🗂', '📅', '📆', '🗒', '🗓', '📇', '📈',
  '📉', '📊', '📋', '📌', '📍', '📎', '🖇', '📏', '📐', '✂', '🗃', '🗄', '🗑', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝', '🔨',
  '🪓', '⛏', '⚒', '🛠', '🗡', '⚔', '💣', '🪃', '🏹', '🛡', '🪚', '🔧', '🪛', '🔩', '⚙', '🗜', '⚖', '🦯', '🔗', '⛓',
  '🪝', '🧰', '🧲', '🪜', '⚗', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩼', '🩺', '🩻', '🚪', '🛗',
  '🪞', '🪟', '🛏', '🛋', '🪑', '🚽', '🪠', '🚿', '🛁', '🪤', '🪒', '🧴', '🧷', '🧹', '🧺', '🧻', '🪣', '🧼', '🫧', '🪥',
  '🧽', '🧯', '🛒', '🚬', '⚰', '🪦', '⚱', '🧿', '🗿', '🪧', '🪪',
]
