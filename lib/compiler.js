class Complier {
  constructor(config) {
    // 需要保存的入口文件的路径，如 ./src/index.js
    this.entyId 
    // 需要保存的所有模块的依赖
    this.modules = {} 
    this.config = config
    this.entry = config.entry // 入口路径
    this.root = process.cwd() // 项目工作的全局路径
  }

  run() {
    // 创建模块间的依赖关系
    this.bindModule(path.resolve(this.root, this.entry), true)
    // 发射一个打包后的文件
    this.emitFile()
  }

  bindModule(modulePath, isEntry) {

  }

  emitFile() {

  }
}

module.exports = Complier