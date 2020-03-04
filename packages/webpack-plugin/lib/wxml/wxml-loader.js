// const htmlMinifier = require('html-minifier')
const NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin')
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin')
const LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin')
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin')
const LimitChunkCountPlugin = require('webpack/lib/optimize/LimitChunkCountPlugin')

const attrParse = require('./attributesParser')
const loaderUtils = require('loader-utils')
const url = require('url')
const path = require('path')
const hash = require('hash-sum')
const config = require('../config')
const getMainCompilation = require('../utils/get-main-compilation')
const createHelpers = require('../helpers')
const parseRequest = require('../utils/parse-request')
const isUrlRequest = require('../utils/is-url-request')

function randomIdent () {
  return 'xxxHTMLLINKxxx' + Math.random() + Math.random() + 'xxx'
}

module.exports = function (content) {
  const loaderContext = this
  const isProduction = this.minimize || process.env.NODE_ENV === 'production'
  const options = loaderUtils.getOptions(this) || {}
  const callback = this.async()

  const filePath = this.resourcePath

  const context = (
    this.rootContext ||
    (this.options && this.options.context) ||
    process.cwd()
  )
  const shortFilePath = path.relative(context, filePath).replace(/^(\.\.[\\/])+/, '')
  const moduleId = hash(isProduction ? (shortFilePath + '\n' + content) : shortFilePath)

  const needCssSourceMap = (
    !isProduction &&
    this.sourceMap &&
    options.cssSourceMap !== false
  )

  const hasScoped = false
  const hasComment = false
  const isNative = true

  const usingComponents = []

  const mainCompilation = getMainCompilation(this._compilation)
  const mpx = mainCompilation.__mpx__
  const mode = mainCompilation.__mpx__.mode
  const globalSrcMode = mainCompilation.__mpx__.srcMode
  const localSrcMode = loaderUtils.parseQuery(this.resourceQuery || '?').mode
  const srcMode = localSrcMode || globalSrcMode

  const {
    getSrcRequestString
  } = createHelpers(
    loaderContext,
    options,
    moduleId,
    isProduction,
    hasScoped,
    hasComment,
    usingComponents,
    needCssSourceMap,
    srcMode,
    isNative,
    options.root || ''
  )

  const attributes = ['image:src', 'audio:src', 'video:src', 'cover-image:src', 'import:src', 'include:src', `${config[mode].wxs.tag}:${config[mode].wxs.src}`]

  const links = attrParse(content, function (tag, attr) {
    const res = attributes.find(function (a) {
      if (a.charAt(0) === ':') {
        return attr === a.slice(1)
      } else {
        return (tag + ':' + attr) === a
      }
    })
    return !!res
  })
  links.reverse()
  const data = {}
  content = [content]
  links.forEach(function (link) {
    if (!isUrlRequest(link.value, options.root)) return

    if (link.value.indexOf('mailto:') > -1) return

    // eslint-disable-next-line node/no-deprecated-api
    let uri = url.parse(link.value)
    if (uri.hash !== null && uri.hash !== undefined) {
      uri.hash = null
      link.value = uri.format()
      link.length = link.value.length
    }

    let ident
    do {
      ident = randomIdent()
    } while (data[ident])
    data[ident] = link
    let x = content.pop()
    content.push(x.substr(link.start + link.length))
    content.push(ident)
    content.push(x.substr(0, link.start))
  })
  content.reverse()
  content = content.join('')

  // if (isProduction) {
  //   const minimizeOptions = Object.assign({}, options);
  //   [
  //     'removeComments',
  //     'removeCommentsFromCDATA',
  //     'removeCDATASectionsFromCDATA',
  //     'caseSensitive',
  //     'collapseWhitespace',
  //     'conservativeCollapse',
  //     'useShortDoctype',
  //     'keepClosingSlash',
  //     'removeScriptTypeAttributes',
  //     'removeStyleTypeAttributes'
  //   ].forEach(function (name) {
  //     if (typeof minimizeOptions[name] === 'undefined') {
  //       minimizeOptions[name] = true
  //     }
  //   })
  //
  //   const KEY_IGNORECUSTOM_FRAGMENTS = 'ignoreCustomFragments'
  //   if (typeof minimizeOptions[KEY_IGNORECUSTOM_FRAGMENTS] === 'undefined') {
  //     minimizeOptions[KEY_IGNORECUSTOM_FRAGMENTS] = [/{{[\s\S]*?}}/]
  //   }
  //
  //   content = htmlMinifier.minify(content, minimizeOptions)
  // }

  content = JSON.stringify(content)

  const exportsString = 'module.exports = '
  const templateRequestSet = new Set()

  const parsedRequest = parseRequest(loaderContext.resource)
  const parsedQueryObj = parsedRequest.queryObj
  const originResourcePath = parsedQueryObj.originResourcePath || parsedRequest.resourcePath
  const ret = exportsString + content.replace(/xxxHTMLLINKxxx[0-9.]+xxx/g, function (match) {
    if (!data[match]) return match

    const link = data[match]

    let src = loaderUtils.urlToRequest(link.value, options.root)

    let requestString

    switch (link.tag) {
      case 'import':
      case 'include':
        const opts = { src, mode: localSrcMode }
        if (originResourcePath) {
          opts.addQuery = { originResourcePath }
        }
        requestString = getSrcRequestString('template', opts, -1)
        const rawRequest = requestString.replace(/^"|"$/g, '')
        templateRequestSet.add(rawRequest)
        break
      case config[mode].wxs.tag:
        requestString = getSrcRequestString('wxs', { src, mode: localSrcMode }, -1, undefined, '!!')
        break
      default:
        requestString = JSON.stringify(src)
    }

    return '" + require(' + requestString + ') + "'
  }) + ';'

  const promises = []
  for (const request of templateRequestSet) {
    promises.push(new Promise((resolve, reject) => {
      const childFilename = 'precompile-template-filename'
      const outputOptions = {
        filename: childFilename
      }
      const childCompiler = mainCompilation.createChildCompiler(request, outputOptions, [
        new NodeTemplatePlugin(outputOptions),
        new LibraryTemplatePlugin(null, 'commonjs2'),
        new NodeTargetPlugin(),
        new SingleEntryPlugin(loaderContext.context, request, 'include.wxml'),
        new LimitChunkCountPlugin({ maxChunks: 1 })
      ])

      childCompiler.hooks.afterCompile.tapAsync('MpxWebpackPlugin', (compilation, callback) => {
        // Remove all chunk assets
        compilation.chunks.forEach((chunk) => {
          chunk.files.forEach((file) => {
            delete compilation.assets[file]
          })
        })

        resolve()
      })
      childCompiler.runAsChild((err) => {
        if (err) {
          reject(err)
        }
      })
    }))
  }

  Promise.all(promises)
    .then(() => {
      // console.log(mpx.usedTagMap)
      callback(null, ret)
    })
}
