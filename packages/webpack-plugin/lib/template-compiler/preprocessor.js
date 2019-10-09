// loader for pre-processing templates with e.g. pug

const cons = require('consolidate')
const loaderUtils = require('loader-utils')
const { parseHTML } = require('./compiler')
const getMainCompilation = require('../utils/get-main-compilation')

module.exports = function (content) {
  this.cacheable && this.cacheable()
  const callback = this.async()
  const opt = loaderUtils.getOptions(this) || {}
  const mainCompilation = getMainCompilation(this._compilation)
  const mode = mainCompilation.__mpx__.mode

  if (!cons[opt.engine]) {
    return callback(new Error(
      'Template engine \'' + opt.engine + '\' ' +
      'isn\'t available in Consolidate.js'
    ))
  }

  function doFinalCallback () {
    const templateOption = opt.templateOption

    // for relative includes
    templateOption.filename = this.resourcePath

    cons[opt.engine].render(content, templateOption, function (err, html) {
      if (err) {
        return callback(err)
      }
      callback(null, html)
    })
  }

  // 因为百度template会渲染成真实节点，与其他平台语义都不一致，因此需要将template inline到引用的地方，并修改其data变量名
  if (mode === 'swan') {
    // TODO
    doFinalCallback()
  } else {
    doFinalCallback()
  }
}
