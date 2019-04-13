const fs = require('fs')
const path = require('path')
const server = require('./server.js')
const cwd = process.cwd()

// 获取运行参数
let entry = ''
let port = '8686'
let isBuild = false
let configPath = ''
let config = null

process.argv.forEach(p => {
  if (/\.html$/.test(p)) {
    // 入口
    entry = p
  } else if (p === 'build') {
    // build
    isBuild = true
  } else if (/^\d+$/.test(p)) {
    // 端口
    port = p
  } else if (p.indexOf('--config=') === 0) {
    // 配置
    configPath = p.split('=')[1].replace(/^('|")|\1$/g, '')
  }
})

// 如果指定配置文件则用指定的，否则在package.json同级目录查找默认
if (configPath) {
  config = require(path.resolve(cwd, configPath))
} else {
  const appRootPath = findAppRootPath()
  const defaultConfigPath = path.resolve(appRootPath, '.pr1.config.js')
  if (appRootPath && fs.existsSync(defaultConfigPath)) {
    config = require(defaultConfigPath)
  }
}

function findAppRootPath () {
  let currentPath = cwd
  while (currentPath !== '/' && !/^[a-zA-Z]:\\$/.test(currentPath)) {
    if (fs.existsSync(path.resolve(currentPath, 'package.json'))) {
      return currentPath
    }
    currentPath = path.resolve(currentPath, '..')
  }
  return null
}

if (isBuild) {
  runBuild(entry)
} else {
  server(port, config)
}

function runBuild () {

}