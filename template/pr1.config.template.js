const nodeResolve = require('rollup-plugin-node-resolve')
require('colors')

module.exports = {
  // vendor 子项的第一个值将会整合到 rollup 的 external
  // [0]是开发环境用的，[1]是生产环境用的，如果没有[1]生产环境也用[0]
  vendor: [
    ['vue/dist/vue.esm.browser.js', 'vue/dist/vue.min.js']
  ],
  // true 表示存在同级目录且同名的 html 和 js 文件会被关联到一起
  // 转成 Vue render 组件提高性能，仅生产环境起作用
  html2VueRender: true,
  // 热更新 style or reload
  hot: 'style',
  // dist 打包后文件输出目录，路径应相对于当前配置文件
  dist: '',
  // static 静态文件，路径应相对于 html 入口文件
  static: [],
  // rollup 选项，必须有
  rollupConfig: {
    globals: {
      'vue/dist/vue.esm.browser.js': 'Vue'
    },
    plugins: [
      // rollup-plugin-node-resolve 用于解决引用 node_modules 资源路径
      nodeResolve()
    ]
  },
  // babel 选项，不提供将不会进行转码，不使用 uglify 压缩时，可安装 babel 的 minify 插件压缩
  babelConfig: {
    presets: [
      [
        '@babel/env', {
          modules: false,
          targets: {
            ie: '9',
            chrome: '49'
          }
        }
      ]
    ]
  },
  // uglify 选项，不提供将不会压缩，如果 babel 转码后仍存在 ES6+ 代码，uglify 解释不了将会压缩失败
  uglifyConfig: {
    toplevel: true
  },
  // 打包前的钩子
  beforeBuild: async function (originDir) {
    console.log(`开始打包：`.green + `${originDir}`.cyan)
  },
  // 打包后的钩子
  afterBuild: async function (distDir) {
    console.log(`完成打包：`.green + `${distDir}`.cyan)
  }
}
