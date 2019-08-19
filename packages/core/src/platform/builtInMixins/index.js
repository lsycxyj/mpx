import pageStatusMixin from './pageStatusMixin'
import proxyEventMixin from './proxyEventMixin'
import renderHelperMixin from './renderHelperMixin'
import refsMixin from './refsMixin'
import showMixin from './showMixin'
import relationsMixin from './relationsMixin'

export default function getBuiltInMixins (options, type) {
  return [
    pageStatusMixin(type),
    proxyEventMixin(),
    renderHelperMixin(),
    refsMixin(),
    showMixin(type),
    relationsMixin(type)
  ].filter(item => item)
}
