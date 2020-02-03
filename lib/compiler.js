const path = require('path')
const fs = require('fs')

class Complier {
  constructor(config) {
    // 需要保存的入口文件的路径，如 ./src/index.js
    this.entryId 
    // 需要保存的所有模块的依赖
    this.modules = {} 
    this.config = config
    this.entry = config.entry // 入口路径
    this.root = process.cwd() // 项目工作的全局路径
  }


  run() {
    this.bindModule(path.resolve(this.root, this.entry), true)
    this.emitFile()
  }

  // 创建模块间的依赖关系
  bindModule(modulePath, isEntry) {
    const moduleSource = this.getModuleSource(modulePath)
    const moduleName = './' + path.relative(this.root, modulePath)
    isEntry && (this.entryId = moduleName)
    // 将模块的源码进行改造，并且返回一个依赖的列表
    // 主要是将 require 变成 _webpack_require_
    // 然后将 require('./a.js') 变成 _webpack_require_('./src/a.js')
    const { newModuleSource, dependencies } = 
      this.parse(moduleSource, path.dirname(moduleName))
    
    // 把相对路径和模块中的内容对应起来
    this.modules[moduleName] = newModuleSource
  }

  // 发射一个打包后的文件
  emitFile() {

  }

  getModuleSource(modulePath) {
    return fs.readFileSync(modulePath, 'utf8')
  }

  // 解析模块源码
  parse(moduleSource, parentPath) {
    console.log(moduleSource, parentPath)
  }
}

module.exports = Complier