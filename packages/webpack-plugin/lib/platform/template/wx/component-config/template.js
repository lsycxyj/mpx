const TAG_NAME = 'template'

module.exports = function () {
  return {
    test: TAG_NAME,
    swan (tagName, { attrsMap, attrsList }) {
      // 添加__virtual__属性以不渲染真实节点
      if (attrsMap['name'] && !attrsMap['__virtual__']) {
        attrsMap['__virtual__'] = 'true'
        attrsList.push({
          name: '__virtual__',
          value: 'true'
        })
      }
      return tagName
    },
    props: [
      {
        test: 'data',
        swan ({ name, value }) {
          return {
            name,
            value: `{${value}}`
          }
        }
      }
    ]
  }
}
