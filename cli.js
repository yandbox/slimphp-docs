const get = require('./lib/get')
const download = require('./lib/download')
const writeFile = require('./lib/write-file')
const pMap = require('p-map')

const origin = 'https://www.slimframework.com'
const localBase = '/slimphp'
const links = new Map()
const assets = new Map()

async function fetchPage({ url, file }) {
  let { content: html } = await get(url)
  if (!html) return

  html = html
    .replace(/<!--.+?-->/, '')
    .replace(/<link rel="shortcut.+?>/, '')
    .replace(/<link .+?awesome.+?>/, '')
    .replace(/<script[^]+?<\/script>/g, '')
    .replace(/(a .*?href=")(\/.*?)(?=")/g, (match, prefix, href) => {
      return prefix + mapLink(href)
    })
    .replace(/(=")(\/assets\/.+?)(?=")/g, (match, prefix, href) => {
      return prefix + mapAsset(href)
    })

  html += `<script src="${localBase}/assets/scripts/prism.js"></script>`

  writeFile(file, html)
}

function mapLink(href) {
  if (!href || href[0] === '#' || href.includes(':')) {
    return href
  }

  if (href === '/docs/') {
    links.set(href, {
      url: origin + href,
      localUrl: localBase,
      file: resolvePath('index.html')
    })
    return localBase
  }

  // 目前是 v3
  const onlineBase = '/docs/v3'
  if (!href.startsWith(onlineBase)) {
    if (href[0] === '/') {
      return origin + href
    }
    throw new Error('unhandled href: ' + href)
  }

  let { pathname: p, suffix } = parseUrl(href)

  let data = links.get(p)
  if (data) return data.localUrl

  if (!p.endsWith('.html')) {
    throw new Error('unhandled href: ' + href)
  }

  let p1 = p.slice(onlineBase.length)
  data = {
    url: origin + p + suffix,
    localUrl: localBase + p1 + suffix,
    file: resolvePath(p1)
  }
  links.set(p, data)
  return data.localUrl
}

function parseUrl(p) {
  let suffix = ''  // querystring and hash
  let pathname = p
  let i = p.indexOf('?')
  if (i === -1) {
    i = p.indexOf('#')
  }

  if (i > -1) {
    suffix = p.slice(i)
    pathname = p.slice(0, i)
  }

  return { pathname, suffix }
}

function resolvePath(name) {
  return __dirname + '/public/' + name
}

function mapAsset(p) {
  let data = assets.get(p)
  if (data) return data.localUrl

  data = {
    url: origin + p,
    localUrl: localBase + p,
    file: resolvePath(p)
  }
  assets.set(p, data)
  return data.localUrl
}

async function run() {
  let p = '/docs/'
  mapLink(p)
  await fetchPage(links.get(p))

  await pMap(links, value => {
    return fetchPage(value[1])
  }, { concurrency: 5 })

  const github = 'https://raw.githubusercontent.com/slimphp/Slim-Website/gh-pages';
  [
    '/assets/scripts/prism.js',
    '/assets/images/favicon.png', // 从原网站无法下载
  ].forEach(p => assets.set(p, {
    url: github + p,
    file: resolvePath(p)
  }))

  await pMap(assets, value => {
    const data = value[1]
    return download(data.url, data.file)
  }, { concurrency: 8 })

  // 不处理 web fonts
}

run().catch(console.error)
