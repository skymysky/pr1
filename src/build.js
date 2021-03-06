const rollup = require('rollup')
const path = require('path')
const babel = require('@babel/core')
const uglify = require('uglify-js')
const fs = require('fs-extra')
const { appRootPath, getShortMd5 } = require('./tools.js')
const vueComponent = require('./rollup-plugins/rollup-plugin-pr1.js')
const cwd = process.cwd()

const pr1Plugins = [vueComponent()]

async function bundle (input, out, config, outName) {
  const inputOptions = {
    input: input,
    external: (config.vendor || []).map(i => i[0]),
    plugins: [...config.rollupConfig.plugins, ...pr1Plugins],
    context: 'window'
  }
  const outputOptions = {
    format: 'iife',
    name: outName,
    globals: config.rollupConfig.globals || {},
    file: out // 给 rollup-plugin-pr1 使用
  }
  // rollup
  const bundle = await rollup.rollup(inputOptions)
  const { output } = await bundle.generate(outputOptions)
  let code = output[0].code
  // babel
  if (config.babelConfig) {
    code = babel.transform(code, config.babelConfig).code
  }
  // uglify
  if (config.uglifyConfig) {
    const uglifyResult = uglify.minify(code, config.uglifyConfig)
    if (uglifyResult.error) {
      throw uglifyResult.error
    } else {
      code = uglifyResult.code
    }
  }

  fs.outputFileSync(out, code)
  return code
}

// 给html的src或href添加hash防缓存
function addSrcHash (txt, distDir) {
  let html = txt
  const srcs = txt.match(/(href|src)=("|')?[^ "']+\2?/gm)
  const result = srcs.map(i => {
    const src = i.replace(/^(href|src)=("|')?/, '').replace(/("|')$/, '')
    const absoulteSrc = path.resolve(distDir, src.split('?')[0])
    if (src.indexOf('http') !== 0 && fs.existsSync(absoulteSrc)) {
      return {
        src: i,
        md5Src: i.replace(src, src + (src.indexOf('?') > -1 ? '&' : '?') + `${getShortMd5(fs.readFileSync(absoulteSrc))}`)
      }
    }
    return null
  })
  result.forEach(r => {
    if (r) {
      html = html.replace(r.src, r.md5Src)
    }
  })
  return html
}

async function compileHTML (config, originIndexPath, targetIndexPath) {
  const originDir = path.dirname(originIndexPath)

  // 拷贝入口文件
  const distDir = path.dirname(targetIndexPath)
  fs.copySync(originIndexPath, targetIndexPath)

  // 拷贝第三方工具
  const vendors = []
  const preload = []
  ;(config.vendor || []).forEach(f => {
    const file = f[1] || f[0]
    const fileName = path.basename(file)
    vendors.push(`  <script src="./vendor/${fileName}"></script>`)
    preload.push(`  <link rel="preload" href="./vendor/${fileName}" as="script">`)
    fs.copySync(path.resolve(appRootPath, 'node_modules/', file), path.resolve(distDir, 'vendor/', fileName))
  })

  // 入口js
  const index = fs.readFileSync(originIndexPath)
  const main = /src="([^"]+)\?pr1_module=1"/.exec(index)[1]

  // 拷贝静态文件
  if (config.static) {
    config.static.forEach(f => {
      fs.copySync(path.resolve(originDir, f), path.resolve(distDir, f))
    })
  }

  // 打包rollup
  const input = path.resolve(originDir, main)
  const out = path.resolve(distDir, main)
  const code = await bundle(input, out, config)

  let indexHtml = fs.readFileSync(targetIndexPath).toString()

  // 如果存在 bable 的 regeneratorRuntime，自动加入 profill
  if (/\bregeneratorRuntime\b/.test(code)) {
    fs.copySync(path.resolve(appRootPath, 'node_modules/@babel/polyfill/dist/polyfill.min.js'), path.resolve(distDir, 'vendor/polyfill.min.js'))
    vendors.push(`  <script src="./vendor/polyfill.min.js"></script>`)
    preload.push(`  <link rel="preload" href="./vendor/polyfill.min.js" as="script">`)
  }

  // 将 preload 插入 head
  indexHtml = indexHtml.replace(/<\/head>/, `${preload.join('\n')}\n</head>`)

  // 如果存在如js同名css，加入到index的head里去
  const cssPath = out.replace(/\.js$/, '.css')
  if (fs.existsSync(cssPath)) {
    const relativeCssPath = cssPath.replace(distDir, '').replace(/\\/g, '/')
    indexHtml = indexHtml.replace(/<\/head>/, `  <link rel="stylesheet" href=".${relativeCssPath}">\n</head>`)
  }

  // 将 vendors 插入 pr1_module 之前
  const pr1ModuleScript = /^.+pr1_module=1.+$/m.exec(indexHtml)
  indexHtml = indexHtml.replace(pr1ModuleScript[0], `${vendors.join('\n')}\n${pr1ModuleScript[0]}`)
    // 去掉首页的 pr1_module=1 标识
    .replace(/(\?|&)pr1_module=1/, '')

  // 将index.html里的所有内部路径加上hash
  indexHtml = addSrcHash(indexHtml, distDir)

  fs.writeFileSync(targetIndexPath, indexHtml)
}

async function compile (entry, config, dist) {
  const originIndexPath = path.resolve(cwd, entry)
  const targetIndexPath = path.resolve(dist, entry)

  if (config.beforeBuild) {
    await config.beforeBuild(originIndexPath)
  }

  if (/\.js$/.test(entry)) {
    await bundle(originIndexPath, targetIndexPath, config, `pr1.modules.${path.basename(entry).replace(/\./g, '_')}`)
  } else {
    await compileHTML(config, originIndexPath, targetIndexPath)
  }

  // 执行打包完的回调
  if (config.afterBuild) {
    await config.afterBuild(targetIndexPath)
  }
}

module.exports = {
  build: async function (entry, config, configAbsolutePath) {
    // 清空/创建dist目录
    const dist = config.dist
      ? path.resolve(path.dirname(configAbsolutePath), config.dist)
      : path.resolve(appRootPath, './dist/')

    process.env.PR1_CONFIG_TARGET = dist

    if (fs.existsSync(dist)) {
      fs.removeSync(dist)
    }
    fs.ensureDirSync(dist)

    for (let i = 0; i < entry.length; i++) {
      await compile(entry[i], config, dist)
    }
  }
}
